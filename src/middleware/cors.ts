import corsModule from 'cors';

interface CorsOptions {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void;
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
}

// Figma iframe preview 도메인 패턴 (정규식)
const FIGMA_SITE_PATTERN = /^https:\/\/.*\.figma\.site$/;

// Static allowed origins
const staticAllowedOrigins = [
  'http://localhost:3000',
];

const corsOptions: CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin matches Figma site pattern (https://*.figma.site)
    if (FIGMA_SITE_PATTERN.test(origin)) {
      return callback(null, true);
    }

    // Check static allowed origins
    if (staticAllowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Check environment variable origins
    const envOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o: string) => o.trim())
      : [];
    
    if (envOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Development: allow all localhost origins
    if (process.env.NODE_ENV === 'development' && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return callback(null, true);
    }

    // Origin not allowed
    console.warn(`CORS blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: false, // allow_credentials=False
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'], // allow_methods=["*"]
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'X-CSRF-Token',
    'X-API-Key',
  ], // allow_headers=["*"] - 주요 헤더 모두 포함
};

export default corsModule(corsOptions);
