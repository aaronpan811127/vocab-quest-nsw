import { Card, CardContent } from "@/components/ui/card";

export const PrivacyPolicy = () => {
  return (
    <Card>
      <CardContent className="prose prose-sm dark:prose-invert max-w-none p-6 sm:p-8 space-y-6">
        <section>
          <h3 className="text-lg font-semibold mb-2">1. Introduction</h3>
          <p className="text-muted-foreground leading-relaxed">
            VocabQuests ("we", "us", or "our") is committed to protecting the privacy of all users, including children. This Privacy Policy explains how we collect, use, disclose, and safeguard your personal information when you use our website and services. By using VocabQuests, you consent to the practices described in this policy.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">2. Information We Collect</h3>
          <p className="text-muted-foreground leading-relaxed mb-3">
            We collect the following types of information:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground leading-relaxed space-y-2">
            <li><strong>Account Information:</strong> Email address, username, and password when you create an account.</li>
            <li><strong>Profile Information:</strong> Avatar images and display preferences you choose to provide.</li>
            <li><strong>Usage Data:</strong> Game scores, progress data, study streaks, time spent on activities, and learning analytics.</li>
            <li><strong>Parent Information:</strong> Parent/guardian name, email address, and billing details for subscription management.</li>
            <li><strong>Contact Information:</strong> Name, email, and message content when you contact us through our contact form.</li>
            <li><strong>Technical Data:</strong> Browser type, device information, and general usage patterns to improve our service.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">3. How We Use Your Information</h3>
          <p className="text-muted-foreground leading-relaxed mb-3">
            We use the collected information for the following purposes:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground leading-relaxed space-y-2">
            <li>To provide, maintain, and improve our educational platform and vocabulary games.</li>
            <li>To track learning progress and generate personalised study insights.</li>
            <li>To enable parent/guardian oversight of linked student accounts.</li>
            <li>To process subscription payments and manage billing.</li>
            <li>To communicate with you about your account, updates, or support enquiries.</li>
            <li>To maintain leaderboards and competitive features within the platform.</li>
            <li>To detect and prevent fraud, abuse, or security incidents.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">4. Children's Privacy</h3>
          <p className="text-muted-foreground leading-relaxed">
            VocabQuests is designed for use by students, including children under the age of 13. We take children's privacy very seriously and comply with applicable child protection laws. We only collect information from children that is necessary to provide our educational services. Parent or guardian consent is required for children to create accounts. Parents can review, modify, or request deletion of their child's personal information at any time by contacting us. We do not use children's personal information for advertising or marketing purposes. We do not sell or share children's data with third parties.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">5. Data Sharing & Third Parties</h3>
          <p className="text-muted-foreground leading-relaxed mb-3">
            We do not sell your personal information. We may share limited data with the following third parties solely to operate our service:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground leading-relaxed space-y-2">
            <li><strong>Payment Processor (Stripe):</strong> To securely process subscription payments. We do not store your full payment card details.</li>
            <li><strong>Email Service Provider:</strong> To send transactional emails such as account confirmations and contact form responses.</li>
            <li><strong>Hosting & Infrastructure:</strong> To host and deliver our platform securely and reliably.</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-3">
            All third-party providers are contractually obligated to protect your data and use it only for the purposes we specify.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">6. Data Security</h3>
          <p className="text-muted-foreground leading-relaxed">
            We implement industry-standard security measures to protect your personal information, including encryption of data in transit and at rest, secure authentication mechanisms, regular security assessments, and access controls limiting who can view personal data. While no system is 100% secure, we are committed to protecting your information to the best of our ability.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">7. Data Retention</h3>
          <p className="text-muted-foreground leading-relaxed">
            We retain your personal information for as long as your account is active or as needed to provide our services. If you cancel your subscription, we retain student progress data for 12 months to allow for reactivation. After 12 months of inactivity, we may delete stored data. You may request deletion of your data at any time by contacting us.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">8. Cookies & Tracking</h3>
          <p className="text-muted-foreground leading-relaxed">
            VocabQuests uses essential cookies required for the platform to function correctly, such as maintaining your login session and storing your theme preferences. We do not use advertising or marketing cookies. We do not use third-party tracking or analytics cookies that follow you across other websites.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">9. Your Rights</h3>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Depending on your location, you may have the following rights regarding your personal data:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground leading-relaxed space-y-2">
            <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
            <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data.</li>
            <li><strong>Deletion:</strong> Request deletion of your personal data, subject to legal obligations.</li>
            <li><strong>Portability:</strong> Request your data in a portable format.</li>
            <li><strong>Objection:</strong> Object to certain processing of your data.</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-3">
            To exercise any of these rights, please contact us through our <a href="/contact" className="text-primary hover:underline">Contact page</a>.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">10. International Data Transfers</h3>
          <p className="text-muted-foreground leading-relaxed">
            Your information may be stored and processed in Australia or other countries where our service providers operate. By using VocabQuests, you consent to the transfer of your information to these locations. We ensure that appropriate safeguards are in place to protect your data in accordance with this Privacy Policy.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">11. Changes to This Policy</h3>
          <p className="text-muted-foreground leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the updated policy on our website with a revised "Last updated" date. We encourage you to review this policy periodically. Continued use of VocabQuests after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">12. Contact Us</h3>
          <p className="text-muted-foreground leading-relaxed">
            If you have any questions about this Privacy Policy or how we handle your data, please reach out through our <a href="/contact" className="text-primary hover:underline">Contact page</a>.
          </p>
        </section>
      </CardContent>
    </Card>
  );
};
