// Force disable webpack persistent cache in dev to avoid PackFile corruption on Windows
process.env.NEXT_DISABLE_WEBPACK_CACHE = '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
	webpack: (config, { dev }) => {
		if (dev) {
			config.cache = false; // in-memory only
		}
		return config;
	},
};

export default nextConfig;
