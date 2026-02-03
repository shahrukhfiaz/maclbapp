import { asyncHandler } from '../middleware/asyncHandler';
import { listAuditLogs } from '../services/audit.service';

export const listAuditLogsHandler = asyncHandler(async (_req, res) => {
  const logs = await listAuditLogs();
  return res.status(200).json(logs);
});
