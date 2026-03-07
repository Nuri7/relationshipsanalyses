import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="mx-auto max-w-3xl">
        <Link to="/auth">
          <Button variant="ghost" size="sm" className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>

        <h1 className="mb-2 text-3xl font-bold text-foreground">Privacy Policy</h1>
        <p className="mb-8 text-sm text-muted-foreground">Last updated: March 7, 2026</p>

        <div className="space-y-6 text-foreground/90 leading-relaxed">
          <section>
            <h2 className="mb-2 text-xl font-semibold text-foreground">1. Introduction</h2>
            <p>
              Welcome to Relationship Analyzer ("we," "our," or "us"). We respect your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, and safeguard your information when you use our application.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-foreground">2. Information We Collect</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li><strong>Account Information:</strong> Email address, display name, and password when you create an account.</li>
              <li><strong>Chat Data:</strong> Chat files you upload for analysis. These are stored securely and associated with your account.</li>
              <li><strong>Usage Data:</strong> Information about how you interact with the application, including analysis results and preferences.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-foreground">3. How We Use Your Information</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>To provide and maintain the chat analysis service.</li>
              <li>To generate relationship insights and communication patterns from your uploaded chats.</li>
              <li>To enable sharing features when you choose to share your dashboard.</li>
              <li>To improve and optimize the application experience.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-foreground">4. Data Storage & Security</h2>
            <p>
              Your data is stored securely using industry-standard encryption and access controls. Chat files and analysis results are only accessible to you unless you explicitly choose to share them via a share link. We implement row-level security policies to ensure data isolation between users.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-foreground">5. Data Sharing</h2>
            <p>
              We do not sell, trade, or rent your personal information to third parties. Your chat data and analysis results are private by default. When you generate a share link, only authenticated users with that specific link can view a read-only version of your dashboard.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-foreground">6. AI Processing</h2>
            <p>
              Your uploaded chat data is processed using AI models to generate analysis results, including participant characteristics, relationship dynamics, and communication patterns. This processing occurs on secure servers and the raw chat data is not used to train AI models.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-foreground">7. Data Retention & Deletion</h2>
            <p>
              You can delete your uploaded chats and their associated analyses at any time from your dashboard. When you delete a chat upload, all related analysis data is permanently removed. Account deletion requests can be made by contacting us.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-foreground">8. Your Rights</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>Access and view all data associated with your account.</li>
              <li>Delete your uploaded chats and analyses at any time.</li>
              <li>Revoke shared dashboard links.</li>
              <li>Request complete account deletion.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-foreground">9. Cookies & Local Storage</h2>
            <p>
              We use essential cookies and local storage for authentication and session management. We do not use tracking cookies or third-party analytics.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-foreground">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Any changes will be reflected on this page with an updated revision date. Continued use of the application after changes constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-foreground">11. Contact</h2>
            <p>
              If you have any questions about this Privacy Policy or your data, please reach out through our feedback page within the application.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
