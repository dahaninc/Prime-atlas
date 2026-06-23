import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Privacy Policy | prime-atlas",
  description:
    "Privacy Policy for prime-atlas — how we collect, use, and protect your personal data in accordance with GDPR and UK data protection law.",
};

const EFFECTIVE_DATE = "23 June 2026";
const COMPANY = "prime-atlas Ltd.";
const EMAIL = "privacy@prime-atlas.com";
const DPA_EMAIL = "dpo@prime-atlas.com";

export default async function PrivacyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <>
      <Navbar user={user} />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <nav className="text-xs text-muted-foreground mb-8">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2">/</span>
          <span>Privacy Policy</span>
        </nav>

        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground text-sm mb-10">Effective date: {EFFECTIVE_DATE}</p>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">1. Who We Are</h2>
            <p>
              {COMPANY} (&quot;prime-atlas&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is the data controller responsible
              for your personal data collected through the prime-atlas platform. We are committed
              to protecting your privacy and processing your personal data in accordance with the
              UK General Data Protection Regulation (UK GDPR), the Data Protection Act 2018,
              and the EU General Data Protection Regulation (EU GDPR 2016/679) where applicable
              to users in the European Economic Area.
            </p>
            <p className="mt-3">
              Contact:{" "}
              <a href={`mailto:${EMAIL}`} className="text-pa-green hover:underline">{EMAIL}</a>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">2. Personal Data We Collect</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse mt-2">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Category</th>
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Data</th>
                    <th className="text-left py-2 font-semibold text-foreground">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["Account data", "Name, email address, password (hashed)", "Provided by you at registration"],
                    ["Subscription data", "Payment method (tokenised), billing address, subscription tier, transaction history", "Stripe (payment processor)"],
                    ["Usage data", "Pages visited, features used, search queries, time on page", "Collected automatically"],
                    ["Technical data", "IP address, browser type, device type, operating system", "Collected automatically"],
                    ["Communications", "Emails you send us, support tickets, Capital enquiries", "Provided by you"],
                    ["Watchlist data", "Municipalities and opportunities you save", "Provided by you through use of the Service"],
                    ["Alert preferences", "Email alert settings, signal preferences", "Provided by you"],
                  ].map(([cat, data, source]) => (
                    <tr key={cat}>
                      <td className="py-2 pr-4 font-medium text-foreground align-top">{cat}</td>
                      <td className="py-2 pr-4 align-top">{data}</td>
                      <td className="py-2 align-top">{source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4">
              We do not collect special category data (as defined under Article 9 GDPR) and do
              not use automated profiling to make decisions with legal or similarly significant effects.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">3. Legal Basis for Processing</h2>
            <div className="space-y-3">
              {[
                {
                  basis: "Contract performance (Art. 6(1)(b) GDPR)",
                  use: "Processing your registration, managing your subscription, delivering the Service features you have paid for.",
                },
                {
                  basis: "Legitimate interests (Art. 6(1)(f) GDPR)",
                  use: "Analytics to improve the Service, fraud prevention, security monitoring, and sending product update emails to existing subscribers. We have conducted a balancing test and determined our interests do not override your rights.",
                },
                {
                  basis: "Legal obligation (Art. 6(1)(c) GDPR)",
                  use: "Retaining billing records for VAT and accounting purposes as required by UK and EU law.",
                },
                {
                  basis: "Consent (Art. 6(1)(a) GDPR)",
                  use: "Marketing emails and newsletter subscription. You may withdraw consent at any time by clicking Unsubscribe or contacting us.",
                },
              ].map(({ basis, use }) => (
                <div key={basis} className="border-l-2 border-pa-green/30 pl-4">
                  <p className="font-medium text-foreground text-xs">{basis}</p>
                  <p className="mt-0.5 text-xs">{use}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">4. How We Use Your Data</h2>
            <ul className="space-y-1 list-disc list-inside">
              <li>To create and maintain your account and authenticate your sessions;</li>
              <li>To process payments and manage your subscription via Stripe;</li>
              <li>To deliver Service features including alerts, watchlists, and AI-generated content;</li>
              <li>To send transactional emails (account confirmation, password reset, subscription receipts);</li>
              <li>To send weekly intelligence digests and signal alerts (where enabled);</li>
              <li>To analyse usage patterns and improve platform performance;</li>
              <li>To prevent fraud, abuse, and security incidents;</li>
              <li>To comply with legal and regulatory obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">5. Third-Party Processors</h2>
            <p>
              We share personal data with the following categories of third-party processors
              under appropriate data processing agreements:
            </p>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Processor</th>
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Purpose</th>
                    <th className="text-left py-2 font-semibold text-foreground">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["Supabase", "Database hosting and user authentication", "EU (AWS eu-west-1)"],
                    ["Stripe", "Payment processing and subscription management", "USA (Standard Contractual Clauses)"],
                    ["Resend", "Transactional and marketing email delivery", "USA (Standard Contractual Clauses)"],
                    ["Anthropic (Claude)", "AI-generated investment thesis generation", "USA (Standard Contractual Clauses)"],
                    ["Vercel", "Web application hosting and edge infrastructure", "USA/EU (Standard Contractual Clauses)"],
                    ["PostHog", "Product analytics (anonymised usage data)", "EU"],
                  ].map(([p, purpose, loc]) => (
                    <tr key={p}>
                      <td className="py-2 pr-4 font-medium text-foreground">{p}</td>
                      <td className="py-2 pr-4">{purpose}</td>
                      <td className="py-2">{loc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4">
              We do not sell, rent, or trade your personal data to any third party for their
              marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">6. International Transfers</h2>
            <p>
              Some of our third-party processors are located outside the UK and EU. Where personal
              data is transferred to countries not deemed adequate by the UK ICO or the European
              Commission, we ensure appropriate safeguards are in place, including the use of
              Standard Contractual Clauses (SCCs) approved by the European Commission under
              Article 46(2)(c) GDPR, or the UK International Data Transfer Agreement (IDTA).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">7. Data Retention</h2>
            <ul className="space-y-2 list-none pl-0">
              {[
                ["Account data", "Retained for the duration of your account plus 3 years after closure, unless earlier deletion is requested."],
                ["Billing records", "Retained for 7 years from transaction date to comply with UK HMRC and EU VAT requirements."],
                ["Usage logs", "Retained for 13 months, then aggregated or deleted."],
                ["Marketing consent records", "Retained until consent is withdrawn plus 1 year."],
                ["Support correspondence", "Retained for 3 years from last contact."],
              ].map(([cat, ret]) => (
                <li key={cat} className="border-l-2 border-border pl-4">
                  <p className="font-medium text-foreground">{cat}</p>
                  <p className="text-xs mt-0.5">{ret}</p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">8. Your Rights</h2>
            <p>Under UK GDPR and EU GDPR, you have the following rights:</p>
            <ul className="mt-3 space-y-2 list-none pl-0">
              {[
                ["Right of access (Art. 15)", "Request a copy of the personal data we hold about you."],
                ["Right to rectification (Art. 16)", "Request correction of inaccurate or incomplete personal data."],
                ["Right to erasure (Art. 17)", "Request deletion of your personal data, subject to legal retention obligations."],
                ["Right to restriction (Art. 18)", "Request that we restrict processing of your data in certain circumstances."],
                ["Right to portability (Art. 20)", "Receive your personal data in a structured, machine-readable format."],
                ["Right to object (Art. 21)", "Object to processing based on legitimate interests, including direct marketing."],
                ["Right to withdraw consent", "Withdraw consent at any time where processing is based on consent, without affecting prior lawful processing."],
              ].map(([right, desc]) => (
                <li key={right} className="border-l-2 border-pa-green/30 pl-4">
                  <p className="font-medium text-foreground text-xs">{right}</p>
                  <p className="text-xs mt-0.5">{desc}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4">
              To exercise any of these rights, contact our Data Protection contact at{" "}
              <a href={`mailto:${DPA_EMAIL}`} className="text-pa-green hover:underline">{DPA_EMAIL}</a>.
              We will respond within one calendar month. If you are not satisfied with our response,
              you have the right to lodge a complaint with:
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>
                <strong className="text-foreground">UK:</strong> Information Commissioner&apos;s Office (ICO) at{" "}
                <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-pa-green hover:underline">ico.org.uk</a>
              </li>
              <li>
                <strong className="text-foreground">EU:</strong> The supervisory authority in your EU member state of habitual residence.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">9. Cookies and Tracking</h2>
            <p>
              We use essential cookies required for the Service to function (authentication
              session cookies) and analytics cookies to understand usage patterns. Analytics
              data is processed by PostHog and is anonymised at the point of collection.
            </p>
            <p className="mt-3">
              We do not use advertising cookies or share cookie data with advertising networks.
              You may disable non-essential cookies through your browser settings; doing so will
              not affect your ability to use core Service features.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">10. Security</h2>
            <p>
              We implement appropriate technical and organisational security measures including
              encryption of data in transit (TLS 1.3) and at rest, access controls, regular
              security reviews, and incident response procedures. Passwords are hashed and never
              stored in plaintext. Payment card data is never transmitted to or stored on our servers.
            </p>
            <p className="mt-3">
              In the event of a personal data breach that is likely to result in a risk to your
              rights and freedoms, we will notify the relevant supervisory authority within 72 hours
              and you without undue delay, as required by Article 33 GDPR.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">11. Children</h2>
            <p>
              The Service is not directed at children under the age of 16. We do not knowingly
              collect personal data from children. If we become aware that a child has provided
              us with personal data without parental consent, we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy to reflect changes in our practices or applicable
              law. We will notify you of material changes by email or prominent notice on the
              Service at least 30 days before they take effect. The &quot;Effective date&quot; at the top of
              this page indicates when this version was last revised.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">13. Contact Us</h2>
            <p>
              For privacy-related enquiries:{" "}
              <a href={`mailto:${EMAIL}`} className="text-pa-green hover:underline">{EMAIL}</a>
            </p>
            <p className="mt-2">
              For data subject rights requests:{" "}
              <a href={`mailto:${DPA_EMAIL}`} className="text-pa-green hover:underline">{DPA_EMAIL}</a>
            </p>
            <p className="mt-2">{COMPANY} · Registered in England and Wales</p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-wrap gap-4 text-sm">
          <Link href="/terms" className="text-pa-green hover:underline">Terms of Service →</Link>
          <Link href="/about" className="text-pa-green hover:underline">About →</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
