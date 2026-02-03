#!/usr/bin/env node

const http = require('http');
const https = require('https');
const url = require('url');
const { createProxyMiddleware } = require('http-proxy-middleware');
const express = require('express');

const app = express();
const PROXY_PORT = process.env.PROXY_PORT || 8080;

// Enable CORS for all requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    proxy: 'active',
    timestamp: new Date().toISOString(),
    ip: req.ip || req.connection.remoteAddress
  });
});

// IP check endpoint - returns the server's IP
app.get('/ip', (req, res) => {
  res.json({
    origin: req.ip || req.connection.remoteAddress,
    proxy: 'cloud-server',
    timestamp: new Date().toISOString()
  });
});

// Proxy all other requests
app.use('/', createProxyMiddleware({
  target: 'https://httpbin.org',
  changeOrigin: true,
  pathRewrite: {
    '^/proxy': '' // Remove /proxy prefix if present
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[PROXY] ${req.method} ${req.url} -> ${proxyReq.getHeader('host')}${proxyReq.path}`);
  },
  onError: (err, req, res) => {
    console.error(`[PROXY ERROR] ${req.url}:`, err.message);
    res.status(500).json({ error: 'Proxy error', message: err.message });
  }
}));

// Start the proxy server
app.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`🌐 Cloud Proxy Server running on port ${PROXY_PORT}`);
  console.log(`📡 All traffic will appear to come from this server`);
  console.log(`🔗 Health check: http://localhost:${PROXY_PORT}/health`);
  console.log(`🔗 IP check: http://localhost:${PROXY_PORT}/ip`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Proxy server shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Proxy server shutting down...');
  process.exit(0);
});

