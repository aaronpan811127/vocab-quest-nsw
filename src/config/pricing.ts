// Centralized pricing configuration for consistency across the app

export const PRICING = {
  free: {
    name: "Free Trial",
    monthlyPrice: 0,
    student: {
      features: [
        "Access to first 2 units",
        "All vocabulary games",
        "7-day trial period",
        "Progress tracking",
        "Leaderboard access",
      ],
    },
    parent: {
      features: [
        "Link 1 child",
        "High-level progress overview",
        "Basic activity tracking",
      ],
    },
  },
  premium: {
    name: "Premium",
    monthlyPrice: 19.99,
    annualPrice: 199,
    annualSavings: 40, // $19.99 * 12 = $239.88, annual = $199, savings = ~$40
    student: {
      features: [
        "Unlimited access to all units",
        "All vocabulary games",
        "Priority content updates",
        "Full progress tracking",
        "Leaderboard access",
      ],
    },
    parent: {
      features: [
        "Link up to 3 children",
        "Full detailed progress reports",
        "Words to practice insights",
        "Unit completion tracking",
        "Email support",
      ],
    },
  },
} as const;

export type PlanType = 'monthly' | 'annual';
