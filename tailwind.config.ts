import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			success: {
  				DEFAULT: 'hsl(var(--success))',
  				foreground: 'hsl(var(--success-foreground))'
  			},
  			warning: {
  				DEFAULT: 'hsl(var(--warning))',
  				foreground: 'hsl(var(--warning-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		backgroundImage: {
  			'gradient-primary': 'var(--gradient-primary)',
  			'gradient-secondary': 'var(--gradient-secondary)',
  			'gradient-success': 'var(--gradient-success)',
  			'gradient-hero': 'var(--gradient-hero)'
  		},
  		boxShadow: {
  			glow: 'var(--shadow-glow)',
  			card: 'var(--shadow-card)',
  			button: 'var(--shadow-button)',
  			'2xs': 'var(--shadow-2xs)',
  			xs: 'var(--shadow-xs)',
  			sm: 'var(--shadow-sm)',
  			md: 'var(--shadow-md)',
  			lg: 'var(--shadow-lg)',
  			xl: 'var(--shadow-xl)',
  			'2xl': 'var(--shadow-2xl)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'glow-pulse': {
  				'0%, 100%': {
  					boxShadow: 'var(--shadow-glow)'
  				},
  				'50%': {
  					boxShadow: '0 0 30px hsl(217 91% 60% / 0.5)'
  				}
  			},
  			float: {
  				'0%, 100%': {
  					transform: 'translateY(0px)'
  				},
  				'50%': {
  					transform: 'translateY(-10px)'
  				}
  			},
  			'slide-up': {
  				from: {
  					opacity: '0',
  					transform: 'translateY(20px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			'crosshair-spin': {
  				'0%': { transform: 'rotate(0deg) scale(1)' },
  				'25%': { transform: 'rotate(90deg) scale(1.1)' },
  				'50%': { transform: 'rotate(180deg) scale(1)' },
  				'75%': { transform: 'rotate(270deg) scale(1.1)' },
  				'100%': { transform: 'rotate(360deg) scale(1)' }
  			},
  			'crosshair-lock': {
  				'0%': { transform: 'scale(1.5)', opacity: '0.5' },
  				'50%': { transform: 'scale(0.9)', opacity: '1' },
  				'100%': { transform: 'scale(1)', opacity: '1' }
  			},
  			'bullseye-hit': {
  				'0%': { transform: 'scale(0)', opacity: '1' },
  				'50%': { transform: 'scale(1.5)', opacity: '0.6' },
  				'100%': { transform: 'scale(2)', opacity: '0' }
  			},
  			'card-fly-in': {
  				'0%': { transform: 'translateY(40px) scale(0.8) rotateX(20deg)', opacity: '0' },
  				'60%': { transform: 'translateY(-5px) scale(1.02) rotateX(0deg)', opacity: '1' },
  				'100%': { transform: 'translateY(0) scale(1) rotateX(0deg)', opacity: '1' }
  			},
  			'shake': {
  				'0%, 100%': { transform: 'translateX(0)' },
  				'20%': { transform: 'translateX(-8px)' },
  				'40%': { transform: 'translateX(8px)' },
  				'60%': { transform: 'translateX(-6px)' },
  				'80%': { transform: 'translateX(6px)' }
  			},
  			'target-pulse': {
  				'0%': { boxShadow: '0 0 0 0 hsl(var(--primary) / 0.4)' },
  				'70%': { boxShadow: '0 0 0 15px hsl(var(--primary) / 0)' },
  				'100%': { boxShadow: '0 0 0 0 hsl(var(--primary) / 0)' }
  			},
  			'scope-scan': {
  				'0%': { backgroundPosition: '0% 50%' },
  				'50%': { backgroundPosition: '100% 50%' },
  				'100%': { backgroundPosition: '0% 50%' }
  			},
  			'impact-ring': {
  				'0%': { transform: 'scale(0.3)', opacity: '1', borderWidth: '4px' },
  				'100%': { transform: 'scale(1.8)', opacity: '0', borderWidth: '1px' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
  			float: 'float 3s ease-in-out infinite',
  			'slide-up': 'slide-up 0.5s ease-out',
  			'crosshair-spin': 'crosshair-spin 3s linear infinite',
  			'crosshair-lock': 'crosshair-lock 0.4s ease-out forwards',
  			'bullseye-hit': 'bullseye-hit 0.6s ease-out forwards',
  			'card-fly-in': 'card-fly-in 0.5s ease-out forwards',
  			'shake': 'shake 0.5s ease-out',
  			'target-pulse': 'target-pulse 1.5s ease-out infinite',
  			'scope-scan': 'scope-scan 3s ease-in-out infinite',
  			'impact-ring': 'impact-ring 0.6s ease-out forwards'
  		},
		fontFamily: {
			sans: [
				'Nunito',
				'ui-sans-serif',
				'system-ui',
				'-apple-system',
				'BlinkMacSystemFont',
				'Segoe UI',
				'Roboto',
				'Helvetica Neue',
				'Arial',
				'Noto Sans',
				'sans-serif'
			],
			serif: [
				'Fredoka',
				'ui-serif',
				'Georgia',
				'Cambria',
				'Times New Roman',
				'Times',
				'serif'
			],
			mono: [
				'Comic Neue',
				'ui-monospace',
				'SFMono-Regular',
				'Menlo',
				'Monaco',
				'Consolas',
				'Liberation Mono',
				'Courier New',
				'monospace'
			]
		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
