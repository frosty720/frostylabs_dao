import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	// thirdweb pulls Node-only modules into some client paths; stub them in the browser bundle.
	webpack: (config, { isServer }) => {
		if (!isServer) {
			config.resolve.fallback = {
				...config.resolve.fallback,
				dns: false,
				net: false,
				tls: false,
				fs: false,
				child_process: false,
			};
		}
		return config;
	},
};

export default nextConfig;
