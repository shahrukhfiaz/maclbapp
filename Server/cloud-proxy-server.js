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
    server_ip: req.ip || req.connection.remoteAddress
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

// Simple HTTP proxy for general web traffic
app.use('/', (req, res, next) => {
  // Skip proxy for health and IP endpoints
  if (req.path === '/health' || req.path === '/ip') {
    return next();
  }

  // Get the target URL from query parameter or referer
  let targetUrl = req.query.url || req.headers.referer;
  
  if (!targetUrl) {
    return res.status(400).json({ 
      error: 'Missing target URL', 
      usage: 'Add ?url=https://example.com to proxy requests' 
    });
  }

  try {
    const parsedUrl = new URL(targetUrl);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: req.method,
      headers: {
        ...req.headers,
        host: parsedUrl.host,
        'x-forwarded-for': req.ip || req.connection.remoteAddress,
        'x-forwarded-proto': req.protocol
      }
    };

    const proxyReq = protocol.request(options, (proxyRes) => {
      // Set response headers
      Object.keys(proxyRes.headers).forEach(key => {
        res.setHeader(key, proxyRes.headers[key]);
      });
      
      res.statusCode = proxyRes.statusCode;
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('Proxy error:', err.message);
      res.status(500).json({ error: 'Proxy error', message: err.message });
    });

    // Forward request body
    req.pipe(proxyReq);
    
  } catch (error) {
    console.error('Invalid URL:', error.message);
    res.status(400).json({ error: 'Invalid URL', message: error.message });
  }
});

// Start the proxy server
app.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`🌐 Cloud Proxy Server running on port ${PROXY_PORT}`);
  console.log(`📡 All traffic will appear to come from this server`);
  console.log(`🔗 Health check: http://localhost:${PROXY_PORT}/health`);
  console.log(`🔗 IP check: http://localhost:${PROXY_PORT}/ip`);
  console.log(`🔗 Proxy usage: http://localhost:${PROXY_PORT}?url=https://example.com`);
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

