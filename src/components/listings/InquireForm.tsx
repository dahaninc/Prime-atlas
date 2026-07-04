"use client";

import { useState } from "react";
import Link from "next/link";

interface InquireFormProps {
  listingTitle: string;
  listingId: string;
  contactEmail?: string | null;
  isMember?: boolean;
  isLoggedIn?: boolean;
}

export function InquireForm({ listingTitle, listingId, contactEmail, isMember = false, isLoggedIn = false }: InquireFormProps) {

  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [phone, setPhone]     = useState("");
  const [message, setMessage] = useState(
    `I am interested in this listing and would like more information. Please send further details and let me know the next steps.\n\nListing: ${listingTitle}`
  );
  const [submitted, setSubmitted] = useState(false);

  // ── Locked state for non-members ──────────────────────────────────
  if (!isMember) {
    return (
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        {/* Terminal bar */}
        <div className="px-4 py-2.5 border-b border-border bg-secondary/30 flex items-center justify-between">
          <span className="text-[9px] font-mono font-bold text-muted-foreground/50 uppercase tracking-widest">
            Contact Details
          </span>
          <span className="text-[8px] font-mono font-bold text-pa-amber border border-pa-amber/30 rounded px-1.5 py-0.5 bg-pa-amber/5">
            MEMBERS ONLY
          </span>
        </div>
        <div className="p-6 text-center space-y-4">
          {/* Lock icon */}
          <div className="w-10 h-10 rounded-full border border-border bg-secondary/30 flex items-center justify-center mx-auto">
            <svg className="w-4 h-4 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold mb-1">Contact details are member-only</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Prime Atlas members get direct access to seller and agent contact details.
              From £29.99/month.
            </p>
          </div>
          <div className="space-y-2">
            {!isLoggedIn ? (
              <>
                <Link
                  href="/auth/signup"
                  className="block w-full text-center text-sm font-semibold bg-pa-green text-pa-navy py-2.5 rounded-lg hover:bg-pa-green/90 transition-colors"
                >
                  Create account — from $29.99/mo
                </Link>
                <Link
                  href="/auth/login"
                  className="block w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  Already a member? Sign in
                </Link>
              </>
            ) : (
              <Link
                href="/pricing"
                className="block w-full text-center text-sm font-semibold bg-pa-green text-pa-navy py-2.5 rounded-lg hover:bg-pa-green/90 transition-colors"
              >
                Upgrade to unlock contacts →
              </Link>
            )}
          </div>
          <p className="text-[9px] font-mono text-muted-foreground/30">
            EXPLORER · PROFESSIONAL · INSTITUTIONAL PLANS
          </p>
        </div>
      </div>
    );
  }

  const recipient = contactEmail ?? "deals@prime-atlas.com";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Enquiry: ${listingTitle}`);
    const body    = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}${phone ? `\nPhone: ${phone}` : ""}\n\n${message}\n\n---\nListing ID: ${listingId}`
    );
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="border border-pa-green/30 rounded-xl p-6 bg-pa-green/5 text-center">
        <p className="text-pa-green font-semibold mb-1">Enquiry sent ✓</p>
        <p className="text-sm text-muted-foreground">
          We will be in touch within 1 business day.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-border rounded-xl p-5 bg-card space-y-4"
    >
      <div>
        <h3 className="font-semibold text-sm mb-0.5">Enquire about this listing</h3>
        <p className="text-xs text-muted-foreground">
          We connect you with the relevant agent within 1 business day.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Full name *</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pa-green transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Email *</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pa-green transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">Phone (optional)</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+44 7700 900000"
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pa-green transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">Message</label>
        <textarea
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pa-green transition-colors resize-none"
        />
      </div>

      <button
        type="submit"
        className="w-full bg-pa-green text-pa-navy font-semibold py-3 rounded-lg hover:bg-pa-green/90 transition-colors text-sm"
      >
        Send enquiry →
      </button>

      <p className="text-[10px] text-muted-foreground text-center">
        Your details are not shared with third parties. Prime Atlas introduces you to the
        relevant agent on your behalf.
      </p>
    </form>
  );
}
