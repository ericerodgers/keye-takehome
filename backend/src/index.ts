import express from 'express';
import cors from 'cors';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Server port - defaults to 4000 if not specified in environment */
const PORT = process.env.PORT || 4000;

/** CORS configuration for cross-origin requests */
const CORS_OPTIONS = {
  origin: true, // Allow all origins for now - can be restricted later
  credentials: true
};

// ============================================================================
// DATA MODULE
// ============================================================================

/**
 * Sample financial data for the spreadsheet application
 * Contains product portfolio revenue data across multiple years (2020-2023)
 * 
 * This data represents a fictional company's product portfolio with:
 * - 11 different products/services
 * - Revenue data for 4 years (2020-2023)
 * - A "Total" row with aggregated revenue
 * 
 * @returns Object containing columns and items for the spreadsheet
 */
const getFinancialData = () => ({
  Values: {
    columns: [
      { name: 'Product', key: 'product' },
      { name: '2020', key: '2020' },
      { name: '2021', key: '2021' },
      { name: '2022', key: '2022' },
      { name: '2023', key: '2023' }
    ],
    items: [
      {
        "2020": 5118724.62743667,
        "2021": 2630672.1336451983,
        "2022": 4900641.343221119,
        "2023": 3051708.3179565365,
        "product": "Insight Advisory"
      },
      {
        "2020": 10053102.32082951,
        "2021": 20638163.620427437,
        "2022": 20133558.987846997,
        "2023": 20576136.452683046,
        "product": "OperateX Staffing"
      },
      {
        "2020": 0,
        "2021": 0,
        "2022": 678556.9921597196,
        "2023": 506001.15826520027,
        "product": "CoreSoft Suite"
      },
      {
        "2020": 13876989.775956148,
        "2021": 16360671.534438606,
        "2022": 19448201.024976257,
        "2023": 19218437.057206184,
        "product": "FieldSite On-Prem Services"
      },
      {
        "2020": 12233532.379434094,
        "2021": 10115364.823988268,
        "2022": 14503107.40902886,
        "2023": 13182486.29123322,
        "product": "Helix Maintenance Plans"
      },
      {
        "2020": 30384105.28587226,
        "2021": 41297016.83377707,
        "2022": 57360069.46447201,
        "2023": 38995139.87679954,
        "product": "OperateX Fulfillment"
      },
      {
        "2020": 5037561.922214865,
        "2021": 5579417.41215921,
        "2022": 9373189.793116327,
        "2023": 4486361.521766473,
        "product": "DeliverIT Solutions"
      },
      {
        "2020": 16919566.39171467,
        "2021": 19063973.774449944,
        "2022": 15491301.85611407,
        "2023": 13319315.352194766,
        "product": "Apex ERP Suite"
      },
      {
        "2020": 0,
        "2021": 0,
        "2022": 0,
        "2023": 570575.2985677817,
        "product": "VoxTelecom"
      },
      {
        "2020": 3525691.9490874563,
        "2021": 3654516.208253259,
        "2022": 4528497.993171154,
        "2023": 4542748.243571376,
        "product": "StreamMedia Solutions"
      },
      {
        "2020": 7516404.430851912,
        "2021": 5087514.96625654,
        "2022": 6069512.059807597,
        "2023": 11152557.277514499,
        "product": "Skyline Remote Monitoring"
      },
      {
        "2020": 104665679.08339758,
        "2021": 124427311.30739553,
        "2022": 152486636.9239141,
        "2023": 129601466.84775862,
        "product": "Total"
      }
    ]
  }
});

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Error handling middleware for Express
 * Catches and handles any errors that occur during request processing
 * @param err - The error object
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
const errorHandler = (err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
};

/**
 * Request logging middleware
 * Logs all incoming requests with method, path, status code, and response time
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
const requestLogger = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  next();
};

// ============================================================================
// ROUTES
// ============================================================================

/**
 * Health check endpoint
 * Returns server status and uptime information
 * @param req - Express request object
 * @param res - Express response object
 */
const healthCheck = (req: express.Request, res: express.Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
};

/**
 * Data endpoint - returns financial data for the spreadsheet
 * This is the main endpoint that the frontend calls to get spreadsheet data
 * @param req - Express request object
 * @param res - Express response object
 */
const getData = (req: express.Request, res: express.Response) => {
  try {
    const data = getFinancialData();
    res.json(data);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({
      error: 'Failed to fetch data',
      message: 'Unable to retrieve financial data'
    });
  }
};

// ============================================================================
// APPLICATION SETUP
// ============================================================================

/** Express application instance */
const app = express();

// Apply middleware
app.use(cors(CORS_OPTIONS));
app.use(express.json());
app.use(requestLogger);

// Additional CORS headers as fallback
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Define routes
app.get('/health', healthCheck);
app.get('/api/data', getData);

// Apply error handling middleware last
app.use(errorHandler);

// Handle 404 errors
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

/**
 * Start the Express server
 * Logs the port and handles any startup errors
 */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api/data`);
  console.log(`🏥 Health check at http://localhost:${PORT}/health`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
