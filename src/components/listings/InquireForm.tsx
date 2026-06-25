"use client";

import { useState } from "react";

interface InquireFormProps {
  listingTitle: string;
  listingId: string;
  contactEmail?: string | null;
}

export function InquireForm({ listingTitle, listingId, contactEmail }: InquireFormProps) {
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [phone, setPhone]     = useState("");
  const [message, setMessage] = useState(
    `I am interested in this listing and would like more information. Please send further details and let me know the next steps.\n\nListing: ${listingTitle}`
  );
  const [submitted, setSubmitted] = useState(false);

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
