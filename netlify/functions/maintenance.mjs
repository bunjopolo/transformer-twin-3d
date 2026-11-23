import { getStore } from '@netlify/blobs';
import { createMaintenanceHandler } from '../lib/maintenance-service.mjs';

export default createMaintenanceHandler({
  getStore:()=>getStore({name:'maintenance-library-v1',consistency:'strong'}),
  getPassword:()=>process.env.SITE_PASSWORD,
  getUsername:()=>process.env.SITE_USERNAME||'viewer',
});
export const config={path:'/api/maintenance'};
