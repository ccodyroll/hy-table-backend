// eslint-disable-next-line @typescript-eslint/no-var-requires
const cors = require('cors') as typeof import('cors');

interface CorsOptions {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void;
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
}

const corsOptions: CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o: string) => o.trim())
      : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080'];

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

export default cors(corsOptions);
