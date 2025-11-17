// Force disable webpack persistent cache in dev to avoid PackFile corruption on Windows
process.env.NEXT_DISABLE_WEBPACK_CACHE = '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
	webpack: (config, { dev }) => {
		if (dev) {
			config.cache = false; // in-memory only
			// Limit file system watchers to reduce EMFILE risk
			config.watchOptions = {
				ignored: [
					'**/node_modules/**',
					'**/.git/**',
					'**/.next/**',
					'**/.turbo/**',
					'**/backups/**',
					'**/public/**',
					'**/prisma/migrations/**',
				],
				// Polling can reduce native handle usage on Windows; increase interval modestly
				poll: 1500,
				aggregateTimeout: 300,
			};
		}
		return config;
	},
};

export default nextConfig;
