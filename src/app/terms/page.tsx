import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Terms of Service | prime-atlas",
  description: "Terms and conditions governing use of the prime-atlas platform.",
};

const EFFECTIVE_DATE = "23 June 2026";
const COMPANY = "prime-atlas Ltd.";
const EMAIL = "legal@prime-atlas.com";

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <nav className="text-xs text-muted-foreground mb-8">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2">/</span>
          <span>Terms of Service</span>
        </nav>

        <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground text-sm mb-10">Effective date: {EFFECTIVE_DATE}</p>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">1. Agreement to Terms</h2>
            <p>
              These Terms of Service (&quot;Terms&quot;) constitute a legally binding agreement between you
              (&quot;User&quot;, &quot;you&quot;) and {COMPANY} (&quot;prime-atlas&quot;, &quot;we&quot;, &quot;us&quot;) governing your access to and
              use of the prime-atlas platform, including the website at prime-atlas.com, associated
              mobile applications, APIs, and all related services (collectively, the &quot;Service&quot;).
            </p>
            <p className="mt-3">
              By creating an account, accessing the Service, or clicking &quot;I agree&quot;, you confirm
              that you have read, understood, and agree to be bound by these Terms and our
              Privacy Policy. If you do not agree, you must not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">2. Service Description</h2>
            <p>
              prime-atlas provides an AI-assisted property intelligence platform that aggregates,
              analyses, and presents data about USA and UK property markets, including live listings,
              infrastructure projects, planning applications, population trends, and economic
              indicators. The Service produces algorithmic Opportunity Scores, conviction ratings, and
              AI-generated investment theses.
            </p>
            <p className="mt-3 font-medium text-foreground">
              The Service is an information platform only. Nothing on the Service constitutes
              financial advice, investment advice, or a recommendation to buy, sell, or hold any
              asset. All scores and analyses are algorithmic estimates derived from public data.
              You must conduct your own due diligence before making any investment decision.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">3. Eligibility</h2>
            <p>To use the Service you must:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Be at least 18 years of age;</li>
              <li>Have full legal capacity to enter into binding contracts in your jurisdiction;</li>
              <li>Not be prohibited from using the Service under applicable law;</li>
              <li>Provide accurate and complete registration information.</li>
            </ul>
            <p className="mt-3">
              If you are using the Service on behalf of a legal entity, you represent that you
              have authority to bind that entity to these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">4. Accounts and Security</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials
              and for all activity that occurs under your account. You must notify us immediately
              at <a href={`mailto:${EMAIL}`} className="text-pa-green hover:underline">{EMAIL}</a> if
              you suspect any unauthorised use of your account.
            </p>
            <p className="mt-3">
              We reserve the right to suspend or terminate accounts that violate these Terms,
              engage in fraudulent activity, or that we reasonably believe have been compromised.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">5. Subscription Plans and Payment</h2>
            <p>
              prime-atlas offers free and paid subscription tiers. Paid subscriptions are billed
              monthly in advance. All prices are shown exclusive of VAT. VAT will be applied at
              the rate applicable in your EU member state or as required by applicable law.
            </p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              <li>
                <strong className="text-foreground">Explorer ($29.99/month):</strong> Access to the
                listings terminal and market intelligence, with 10 contact reveals per month.
              </li>
              <li>
                <strong className="text-foreground">Professional ($69.99/month):</strong> Unlimited contact
                reveals, full investment thesis analytics, macro/micro outlooks, and exit projections.
              </li>
              <li>
                <strong className="text-foreground">Institutional ($89.99/month):</strong> All Professional
                features plus API access, data export, and 3 team seats.
              </li>
            </ul>
            <p className="mt-3">
              Payments are processed by Stripe. You authorise us to charge your payment method
              on a recurring basis until you cancel. Cancellation takes effect at the end of the
              current billing period. No refunds are issued for partial periods.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">6. Right of Withdrawal (EU Consumers)</h2>
            <p>
              If you are a consumer resident in the European Union, you have the right to withdraw
              from a subscription contract within 14 days of the date of purchase without giving
              any reason (&quot;Cooling-Off Period&quot;), provided that you have not accessed paid features
              during that period. To exercise this right, contact us at{" "}
              <a href={`mailto:${EMAIL}`} className="text-pa-green hover:underline">{EMAIL}</a> with
              your account email and subscription date.
            </p>
            <p className="mt-3">
              By accessing paid features before the end of the Cooling-Off Period, you expressly
              request immediate performance of the contract and acknowledge that your right of
              withdrawal is thereby waived, in accordance with Article 16(m) of Directive
              2011/83/EU.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">7. Intellectual Property</h2>
            <p>
              All content on the Service — including but not limited to Opportunity Scores,
              investment theses, index methodologies, design, and software — is the exclusive
              property of {COMPANY} or its licensors and is protected by copyright, database right,
              and other intellectual property laws.
            </p>
            <p className="mt-3">
              You may access and use the Service for your own personal or internal business
              purposes. You may not reproduce, redistribute, sell, or create derivative works
              from any Service content without our prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">8. Prohibited Conduct</h2>
            <p>You agree not to:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Scrape, crawl, or systematically download Service data without written permission;</li>
              <li>Use the Service to build a competing product or service;</li>
              <li>Circumvent any access controls or subscription restrictions;</li>
              <li>Share your account credentials with third parties;</li>
              <li>Submit false, misleading, or fraudulent information;</li>
              <li>Interfere with the integrity or performance of the Service;</li>
              <li>Use the Service in any manner that violates applicable law.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">9. Disclaimers and Limitation of Liability</h2>
            <p>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND,
              EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT SCORES ARE ACCURATE, COMPLETE, OR
              SUITABLE FOR ANY PARTICULAR PURPOSE.
            </p>
            <p className="mt-3">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, OUR TOTAL LIABILITY TO YOU FOR
              ANY CLAIM ARISING OUT OF OR RELATING TO THE SERVICE SHALL NOT EXCEED THE AMOUNT
              YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM.
            </p>
            <p className="mt-3">
              Nothing in these Terms limits liability for death or personal injury caused by
              negligence, fraud, or any other liability that cannot be excluded under applicable
              EU or English law.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">10. Termination</h2>
            <p>
              You may cancel your subscription at any time through the Customer Portal. We may
              suspend or terminate your access immediately if you breach these Terms, fail to
              pay, or if we are required to do so by law. On termination, your right to access
              paid features ceases immediately.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">11. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of material changes
              by email or prominent notice on the Service at least 30 days before the changes
              take effect. Continued use of the Service after changes take effect constitutes
              acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">12. Governing Law and Dispute Resolution</h2>
            <p>
              These Terms are governed by the laws of England and Wales. Any dispute arising
              from or in connection with these Terms shall be subject to the exclusive jurisdiction
              of the courts of England and Wales, except where mandatory consumer protection law
              in your EU member state provides otherwise.
            </p>
            <p className="mt-3">
              EU consumers may also use the European Commission&apos;s Online Dispute Resolution
              platform at{" "}
              <a
                href="https://ec.europa.eu/consumers/odr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-pa-green hover:underline"
              >
                ec.europa.eu/consumers/odr
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">13. Contact</h2>
            <p>
              For questions about these Terms, contact us at{" "}
              <a href={`mailto:${EMAIL}`} className="text-pa-green hover:underline">{EMAIL}</a>.
            </p>
            <p className="mt-2">
              {COMPANY} · Registered in England and Wales
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-wrap gap-4 text-sm">
          <Link href="/privacy" className="text-pa-green hover:underline">Privacy Policy →</Link>
          <Link href="/about" className="text-pa-green hover:underline">About →</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
