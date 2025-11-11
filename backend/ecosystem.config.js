export default {
  apps: [
    {
      name: 'weebform-api',        
      script: 'index.js',         
      instances: 'max',
      exec_mode: 'cluster',      
      env_production: {   
        NODE_ENV: 'production',
      },
    },
    {
      name: 'weebform-worker',  
      script: 'services/worker.js',
      instances: 1, 
      env_production: { 
        NODE_ENV: 'production',
      },
    },
  ],
};