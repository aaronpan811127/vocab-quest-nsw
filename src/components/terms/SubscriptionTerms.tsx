import { Card, CardContent } from "@/components/ui/card";
import { PRICING } from "@/config/pricing";

export const SubscriptionTerms = () => {
  return (
    <Card>
      <CardContent className="prose prose-sm dark:prose-invert max-w-none p-6 sm:p-8 space-y-6">
        <section>
          <h3 className="text-lg font-semibold mb-2">1. Subscription Overview</h3>
          <p className="text-muted-foreground leading-relaxed">
            VocabQuests (ABN: 83 270 759 669) offers a Premium subscription plan ("{PRICING.premium.name}") that provides enhanced access to our educational platform. By subscribing, you agree to these Subscription Terms and Conditions in addition to our Website Terms and Conditions. The Premium plan is available at ${PRICING.premium.monthlyPrice}/month or ${PRICING.premium.annualPrice}/year.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">2. Free Trial</h3>
          <p className="text-muted-foreground leading-relaxed">
            VocabQuests offers a 7-day free trial period for new student accounts. During the trial, students have access to the first 2 units and all vocabulary games. Parents may link 1 child and view high-level progress reports during the trial period. No credit card is required for the free trial. After the trial period expires, continued access to all features requires an active Premium subscription.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">3. Billing & Payment</h3>
          <p className="text-muted-foreground leading-relaxed">
            Subscription fees are billed in advance on a monthly or annual basis depending on the plan you select. Payment is processed securely through our third-party payment processor, Stripe. By providing your payment information, you authorise VocabQuests to charge the applicable subscription fee to your nominated payment method. All prices are in Australian Dollars (AUD) unless otherwise specified.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">4. Automatic Renewal</h3>
          <p className="text-muted-foreground leading-relaxed">
            Your subscription will automatically renew at the end of each billing period unless you cancel it before the renewal date. You will be charged the then-current subscription fee upon renewal. We will notify you of any price changes before they take effect. You can manage your subscription and billing through the parent dashboard's subscription management portal.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">5. Cancellation & Refunds</h3>
          <p className="text-muted-foreground leading-relaxed">
            You may cancel your subscription at any time through the subscription management portal in your parent dashboard. Upon cancellation, your subscription will remain active until the end of the current billing period. No partial refunds will be issued for the remaining period of a cancelled subscription. If you believe you are entitled to a refund due to technical issues or billing errors, please contact us within 14 days of the charge through our Contact page.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">6. Subscription Features</h3>
          <p className="text-muted-foreground leading-relaxed">
            The Premium subscription includes: unlimited access to all vocabulary units and games for linked student accounts; the ability to link up to 3 student accounts; full detailed progress reports; words-to-practice insights; unit completion tracking; and email support. VocabQuests reserves the right to modify, add, or remove subscription features at any time, with reasonable notice provided to subscribers.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">7. Account Linking</h3>
          <p className="text-muted-foreground leading-relaxed">
            Premium subscribers (parents/guardians) may link up to 3 student accounts to their subscription. Each student account must have a unique email address. The parent/guardian is responsible for all activity conducted through linked student accounts. Unlinking a student account does not automatically delete the student's data or progress.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">8. Service Availability</h3>
          <p className="text-muted-foreground leading-relaxed">
            VocabQuests strives to maintain continuous service availability but does not guarantee uninterrupted access. Scheduled maintenance, technical issues, or circumstances beyond our control may result in temporary service disruptions. We will endeavour to notify subscribers of planned maintenance in advance. Prolonged service outages may be eligible for pro-rated credit at VocabQuests' discretion.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">9. Price Changes</h3>
          <p className="text-muted-foreground leading-relaxed">
            VocabQuests reserves the right to adjust subscription pricing. Any price increase will take effect at the start of the next billing cycle following a minimum 30-day notice period. You will be notified of price changes via the email address associated with your account. If you do not agree to the new pricing, you may cancel your subscription before the new pricing takes effect.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">10. Acceptable Use</h3>
          <p className="text-muted-foreground leading-relaxed">
            Subscribers agree not to share account credentials with non-authorised users, attempt to circumvent subscription restrictions or access controls, use the service for any commercial purpose without written consent, or engage in any activity that may disrupt the service for other users. Violation of these terms may result in immediate suspension or termination of your subscription without refund.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">11. Data Retention</h3>
          <p className="text-muted-foreground leading-relaxed">
            Upon cancellation or expiration of your subscription, student progress data and account information will be retained for 12 months. During this period, you may reactivate your subscription and regain access to all previously saved data. After 12 months of inactivity, VocabQuests reserves the right to delete stored data in accordance with applicable data protection laws.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">12. Contact Us</h3>
          <p className="text-muted-foreground leading-relaxed">
            For any questions regarding your subscription, billing, or these terms, please reach out through our <a href="/contact" className="text-primary hover:underline">Contact page</a>.
          </p>
        </section>
      </CardContent>
    </Card>
  );
};
