import { Card, CardContent } from "@/components/ui/card";

export const WebsiteTerms = () => {
  return (
    <Card>
      <CardContent className="prose prose-sm dark:prose-invert max-w-none p-6 sm:p-8 space-y-6">
        <section>
          <h3 className="text-lg font-semibold mb-2">1. Acceptance of Terms</h3>
          <p className="text-muted-foreground leading-relaxed">
            By accessing and using the VocabQuests website ("Website"), which is operated by VocabQuests (ABN: 83 270 759 669), you agree to be bound by these Website Terms and Conditions ("Terms"). If you do not agree to these Terms, please do not use the Website. These Terms apply to all visitors, users, and others who access or use the Website.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">2. Use of the Website</h3>
          <p className="text-muted-foreground leading-relaxed">
            You agree to use the Website only for lawful purposes and in a way that does not infringe the rights of, restrict, or inhibit anyone else's use and enjoyment of the Website. Prohibited behaviour includes harassing or causing distress or inconvenience to any other user, transmitting obscene or offensive content, or disrupting the normal flow of dialogue within the Website.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">3. Intellectual Property</h3>
          <p className="text-muted-foreground leading-relaxed">
            All content on this Website, including but not limited to text, graphics, logos, icons, images, audio clips, digital downloads, data compilations, and software, is the property of VocabQuests or its content suppliers and is protected by Australian and international copyright laws. The compilation of all content on this Website is the exclusive property of VocabQuests.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">4. User Accounts</h3>
          <p className="text-muted-foreground leading-relaxed">
            When you create an account with us, you must provide information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of these Terms. You are responsible for safeguarding the password that you use to access the Website and for any activities or actions under your password. You must notify us immediately upon becoming aware of any breach of security or unauthorised use of your account.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">5. Children's Privacy</h3>
          <p className="text-muted-foreground leading-relaxed">
            VocabQuests is designed for use by students, including children under the age of 13. We take children's privacy seriously. Parent or guardian consent is required for students to create and use accounts. Parents and guardians can review, modify, or delete their child's personal information by contacting us. We do not knowingly collect personal information from children without parental consent.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">6. Privacy & Data Collection</h3>
          <p className="text-muted-foreground leading-relaxed">
            Your use of the Website is also governed by our approach to data protection. We collect personal information such as email addresses, usernames, and usage data to provide and improve our services. We do not sell or share your personal data with third parties for marketing purposes. All data is stored securely using industry-standard encryption and security measures.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">7. Disclaimer of Warranties</h3>
          <p className="text-muted-foreground leading-relaxed">
            The Website is provided on an "as is" and "as available" basis. VocabQuests makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property. VocabQuests does not guarantee that the Website will be uninterrupted, timely, secure, or error-free.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">8. Limitation of Liability</h3>
          <p className="text-muted-foreground leading-relaxed">
            In no event shall VocabQuests, its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Website. To the maximum extent permitted by applicable Australian law, VocabQuests' total liability shall not exceed the amount you have paid to VocabQuests in the past twelve months.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">9. Third-Party Links</h3>
          <p className="text-muted-foreground leading-relaxed">
            The Website may contain links to third-party websites or services that are not owned or controlled by VocabQuests. VocabQuests has no control over, and assumes no responsibility for, the content, privacy policies, or practices of any third-party websites or services. You acknowledge and agree that VocabQuests shall not be responsible or liable for any damage or loss caused by or in connection with the use of any such third-party content, goods, or services.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">10. Governing Law</h3>
          <p className="text-muted-foreground leading-relaxed">
            These Terms shall be governed by and construed in accordance with the laws of New South Wales, Australia, without regard to its conflict of law provisions. Any disputes arising out of or relating to these Terms or the Website shall be resolved in the courts of New South Wales, Australia.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">11. Changes to Terms</h3>
          <p className="text-muted-foreground leading-relaxed">
            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion. By continuing to access or use the Website after those revisions become effective, you agree to be bound by the revised terms.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-2">12. Contact Us</h3>
          <p className="text-muted-foreground leading-relaxed">
            If you have any questions about these Terms, please contact us through our <a href="/contact" className="text-primary hover:underline">Contact page</a>.
          </p>
        </section>
      </CardContent>
    </Card>
  );
};
