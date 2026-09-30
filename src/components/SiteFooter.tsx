"use client";

import { useEffect, useState } from "react";

type FooterPanel =
  | "privacy"
  | "terms"
  | "sponsorship"
  | "advertising"
  | null;

const PANELS: Record<
  Exclude<FooterPanel, null>,
  { label: string; eyebrow: string; title: string }
> = {
  privacy: {
    label: "Privacy Policy",
    eyebrow: "YOUR PRIVACY",
    title: "Privacy Policy",
  },
  terms: {
    label: "Terms & Conditions",
    eyebrow: "USING SAHABA QUEST",
    title: "Terms & Conditions",
  },
  sponsorship: {
    label: "Sponsorship",
    eyebrow: "PARTNER WITH US",
    title: "Sponsor Sahaba Quest",
  },
  advertising: {
    label: "Advertising",
    eyebrow: "REACH OUR AUDIENCE",
    title: "Advertise on Sahaba Quest",
  },
};

export default function SiteFooter() {
  const [panel, setPanel] = useState<FooterPanel>(null);

  useEffect(() => {
    if (!panel) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPanel(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [panel]);

  const openPanel = (next: Exclude<FooterPanel, null>) => {
    setPanel(next);
  };

  return (
    <>
      <footer className="sq-site-footer">
        <div className="sq-footer-shell">
          {/* BRAND / COMPANY */}
          <div className="sq-footer-main">
            <div className="sq-footer-brand">
              <div className="sq-footer-brand-mark">
                <span>SQ</span>
              </div>

              <div>
                <div className="sq-footer-brand-name">
                  Sahaba Quest
                </div>

                <div className="sq-footer-tagline">
                  Learn. Remember. Compete.
                </div>
              </div>
            </div>

            <p className="sq-footer-intro">
              A gamified Islamic learning platform designed to make
              learning about the Sahabah and Sahabiyat engaging,
              memorable and meaningful.
            </p>

            <div className="sq-footer-company">
              <strong>Sahaba Quest</strong> is a product of{" "}
              <strong>Deen Skyline Limited</strong>

              <span>RC 1996919</span>
            </div>
          </div>

          {/* INFORMATION */}
          <div className="sq-footer-column">
            <div className="sq-footer-heading">
              Information
            </div>

            <button
              type="button"
              onClick={() => openPanel("privacy")}
            >
              Privacy Policy
            </button>

            <button
              type="button"
              onClick={() => openPanel("terms")}
            >
              Terms &amp; Conditions
            </button>

            <button
              type="button"
              onClick={() => openPanel("sponsorship")}
            >
              Sponsorship
            </button>

            <button
              type="button"
              onClick={() => openPanel("advertising")}
            >
              Advertising
            </button>
          </div>

          {/* CONTACT */}
          <div className="sq-footer-column">
            <div className="sq-footer-heading">
              Contact
            </div>

            <a href="mailto:info@sahabaquest.com.ng">
              info@sahabaquest.com.ng
            </a>

            <a
              href="https://wa.me/2349060479725"
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>

            <a
              href="https://sahabaquest.com.ng"
              target="_blank"
              rel="noopener noreferrer"
            >
              sahabaquest.com.ng
            </a>
          </div>

          {/* DEEN SKYLINE */}
          <div className="sq-footer-logo-card">
            <img
              src="https://cdn.phototourl.com/member/2026-09-30-ba9ce3f3-bc88-422f-a6cb-237b0619e02f.jpg"
              alt="Deen Skyline Limited"
            />

            <div>
              <div className="sq-footer-logo-title">
                Deen Skyline Limited
              </div>

              <div className="sq-footer-logo-subtitle">
                The company behind Sahaba Quest
              </div>
            </div>
          </div>
        </div>

        {/* COPYRIGHT */}
        <div className="sq-footer-bottom">
          <span>
            © {new Date().getFullYear()} Deen Skyline Limited.
          </span>

          <span>
            All rights reserved.
          </span>
        </div>
      </footer>

      {/* INFORMATION MODAL */}
      {panel && (
        <div
          className="sq-footer-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPanel(null);
            }
          }}
        >
          <section
            className="sq-footer-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sq-footer-modal-title"
          >
            <button
              type="button"
              className="sq-footer-close"
              aria-label="Close"
              onClick={() => setPanel(null)}
            >
              ×
            </button>

            <div className="sq-footer-modal-top">
              <div className="sq-footer-modal-icon">
                SQ
              </div>

              <div>
                <div className="sq-footer-modal-eyebrow">
                  {PANELS[panel].eyebrow}
                </div>

                <h2 id="sq-footer-modal-title">
                  {PANELS[panel].title}
                </h2>
              </div>
            </div>

            <div className="sq-footer-modal-content">
              {panel === "privacy" && <PrivacyContent />}

              {panel === "terms" && <TermsContent />}

              {panel === "sponsorship" && (
                <SponsorshipContent />
              )}

              {panel === "advertising" && (
                <AdvertisingContent />
              )}
            </div>

            <div className="sq-footer-modal-contact">
              <strong>
                Deen Skyline Limited
              </strong>

              <span>
                RC 1996919
              </span>

              <a href="mailto:info@sahabaquest.com.ng">
                info@sahabaquest.com.ng
              </a>

              <a
                href="https://wa.me/2349060479725"
                target="_blank"
                rel="noopener noreferrer"
              >
                +234 906 047 9725
              </a>
            </div>
          </section>
        </div>
      )}

      <style jsx>{`
        .sq-site-footer {
          margin-top: 48px;
          padding: 42px 18px 18px;
          background:
            radial-gradient(
              circle at 15% 0%,
              rgba(83, 214, 201, 0.16),
              transparent 34%
            ),
            linear-gradient(
              135deg,
              #073d3a 0%,
              #0b5752 58%,
              #0d6861 100%
            );
          color: #f4fffd;
        }

        .sq-footer-shell {
          width: min(1180px, 100%);
          margin: 0 auto;
          display: grid;
          grid-template-columns:
            1.7fr
            1fr
            1fr
            1.15fr;
          gap: 28px;
          align-items: start;
        }

        .sq-footer-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .sq-footer-brand-mark,
        .sq-footer-modal-icon {
          width: 46px;
          height: 46px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #bff5ed;
          color: #08645d;
          font-weight: 950;
          letter-spacing: -0.04em;
          box-shadow:
            0 8px 24px rgba(0, 0, 0, 0.12);
        }

        .sq-footer-brand-name {
          font-size: 20px;
          font-weight: 950;
          letter-spacing: -0.03em;
        }

        .sq-footer-tagline {
          margin-top: 2px;
          color: #a9ddd7;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
        }

        .sq-footer-intro {
          max-width: 440px;
          margin: 17px 0 14px;
          color: #c5e7e3;
          font-size: 13px;
          line-height: 1.7;
        }

        .sq-footer-company {
          display: flex;
          flex-wrap: wrap;
          gap: 5px 7px;
          color: #e4f7f4;
          font-size: 12px;
          line-height: 1.5;
        }

        .sq-footer-company span {
          width: 100%;
          color: #9ed6d0;
        }

        .sq-footer-heading {
          margin-bottom: 13px;
          color: #aee9e2;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .sq-footer-column {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .sq-footer-column button,
        .sq-footer-column a {
          width: fit-content;
          padding: 0;
          border: 0;
          background: transparent;
          color: #eefbf9;
          font: inherit;
          font-size: 13px;
          line-height: 1.5;
          text-decoration: none;
          text-align: left;
          cursor: pointer;
          transition:
            color 0.18s ease,
            transform 0.18s ease;
        }

        .sq-footer-column button:hover,
        .sq-footer-column a:hover {
          color: #bff5ed;
          transform: translateX(2px);
        }

        .sq-footer-logo-card {
          min-height: 128px;
          padding: 14px;
          border: 1px solid
            rgba(191, 245, 237, 0.18);
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.09);
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .sq-footer-logo-card img {
          width: 72px;
          height: 72px;
          border-radius: 14px;
          object-fit: contain;
          background: white;
          flex: 0 0 auto;
        }

        .sq-footer-logo-title {
          font-size: 13px;
          font-weight: 900;
          line-height: 1.4;
        }

        .sq-footer-logo-subtitle {
          margin-top: 4px;
          color: #abdcd7;
          font-size: 11px;
          line-height: 1.45;
        }

        .sq-footer-bottom {
          width: min(1180px, 100%);
          margin: 30px auto 0;
          padding-top: 17px;
          border-top: 1px solid
            rgba(191, 245, 237, 0.16);
          display: flex;
          justify-content: space-between;
          gap: 12px;
          color: #94cbc5;
          font-size: 11px;
        }

        .sq-footer-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          padding: 20px;
          background: rgba(3, 28, 27, 0.58);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .sq-footer-modal {
          position: relative;
          width: min(820px, 100%);
          max-height: min(86vh, 760px);
          overflow-y: auto;
          border: 1px solid
            rgba(13, 104, 97, 0.12);
          border-radius: 26px;
          background:
            radial-gradient(
              circle at 100% 0%,
              rgba(185, 246, 237, 0.42),
              transparent 32%
            ),
            #ffffff;
          color: #153b39;
          box-shadow:
            0 30px 80px rgba(0, 0, 0, 0.22);
        }

        .sq-footer-close {
          position: absolute;
          top: 15px;
          right: 15px;
          width: 38px;
          height: 38px;
          border: 1px solid #dcebe8;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.9);
          color: #19423f;
          font-size: 25px;
          line-height: 1;
          cursor: pointer;
        }

        .sq-footer-modal-top {
          padding: 28px 68px 20px 28px;
          display: flex;
          align-items: center;
          gap: 14px;
          border-bottom: 1px solid #e5efed;
        }

        .sq-footer-modal-eyebrow {
          color: #13877d;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.12em;
        }

        .sq-footer-modal-top h2 {
          margin: 4px 0 0;
          color: #143d3a;
          font-size: 28px;
          line-height: 1.15;
          letter-spacing: -0.03em;
        }

        .sq-footer-modal-content {
          padding: 26px 28px 8px;
        }

        .sq-footer-modal-content
          :global(.policy-section) {
          margin-bottom: 23px;
          padding: 18px 19px;
          border: 1px solid #e3efed;
          border-radius: 18px;
          background:
            linear-gradient(
              135deg,
              #ffffff,
              #f5fbfa
            );
        }

        .sq-footer-modal-content
          :global(h3) {
          margin: 0 0 7px;
          color: #126d66;
          font-size: 16px;
        }

        .sq-footer-modal-content
          :global(p),
        .sq-footer-modal-content
          :global(li) {
          color: #536c69;
          font-size: 13px;
          line-height: 1.72;
        }

        .sq-footer-modal-content
          :global(p) {
          margin: 0;
        }

        .sq-footer-modal-content
          :global(ul) {
          margin: 9px 0 0;
          padding-left: 20px;
        }

        .sq-footer-modal-contact {
          margin: 12px 28px 28px;
          padding: 16px 18px;
          border-radius: 17px;
          background: #eafaf7;
          display: flex;
          flex-wrap: wrap;
          gap: 7px 14px;
          color: #3e6662;
          font-size: 12px;
        }

        .sq-footer-modal-contact a {
          color: #08766d;
          font-weight: 800;
          text-decoration: none;
        }

        @media (max-width: 900px) {
          .sq-footer-shell {
            grid-template-columns:
              1.4fr
              1fr
              1fr;
          }

          .sq-footer-logo-card {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 640px) {
          .sq-site-footer {
            margin-top: 30px;
            padding: 34px 15px 16px;
          }

          .sq-footer-shell {
            grid-template-columns: 1fr 1fr;
            gap: 25px 18px;
          }

          .sq-footer-main {
            grid-column: 1 / -1;
          }

          .sq-footer-logo-card {
            grid-column: 1 / -1;
          }

          .sq-footer-bottom {
            margin-top: 24px;
            flex-direction: column;
          }

          .sq-footer-overlay {
            padding: 10px;
          }

          .sq-footer-modal {
            max-height: 92vh;
            border-radius: 21px;
          }

          .sq-footer-modal-top {
            padding: 22px 56px 18px 20px;
          }

          .sq-footer-modal-top h2 {
            font-size: 23px;
          }

          .sq-footer-modal-content {
            padding: 18px 15px 4px;
          }

          .sq-footer-modal-content
            :global(.policy-section) {
            padding: 15px;
            margin-bottom: 15px;
          }

          .sq-footer-modal-contact {
            margin: 10px 15px 18px;
          }
        }
      `}</style>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <PolicySection title="Our approach">
        Sahaba Quest is a product of Deen Skyline Limited.
        We collect and use information that is needed to
        operate the platform, provide account features, manage
        progress, support subscriptions and competitions,
        communicate important service information, and keep
        the platform secure.
      </PolicySection>

      <PolicySection title="Information we may use">
        This can include your account name, username, email
        address, account type, game progress, quiz and
        challenge results, subscription information, payment
        transaction details, and technical information needed
        to operate the service.
      </PolicySection>

      <PolicySection title="Sponsored competitions">
        If you choose to participate in an eligible Sponsored
        Competition, we may request your WhatsApp number and
        consent so that competition organisers can have an
        appropriate way to contact winners or provide
        relevant competition communication. We do not sell
        your WhatsApp contact information.
      </PolicySection>

      <PolicySection title="Emails and service communication">
        Your registered email may be used for account
        verification, password recovery, subscription notices,
        security messages, customer support, and other
        important service communication.
      </PolicySection>

      <PolicySection title="Payments and service providers">
        Payments are handled through the payment services used
        by Sahaba Quest. We use third-party services where
        necessary for authentication, email, hosting, payments
        and other platform operations.
      </PolicySection>

      <PolicySection title="Islamic educational content">
        Sahaba Quest is designed as an educational platform.
        We aim to handle Islamic learning content respectfully
        and responsibly. The platform is not a substitute for
        qualified scholarly advice or a personal fatwa.
      </PolicySection>

      <PolicySection title="Your questions and requests">
        If you have a privacy question or need help with
        information connected to your account, contact us at
        info@sahabaquest.com.ng.
      </PolicySection>
    </>
  );
}

function TermsContent() {
  return (
    <>
      <PolicySection title="Using Sahaba Quest">
        Sahaba Quest is a gamified Islamic learning platform
        operated by Deen Skyline Limited. By creating an
        account or using the platform, you agree to use the
        service responsibly and in accordance with these
        terms.
      </PolicySection>

      <PolicySection title="Purpose of the platform">
        Sahaba Quest is built to make learning about the
        Sahabah and Sahabiyat engaging through quizzes,
        challenges, daily learning, competitions and related
        educational features.
      </PolicySection>

      <PolicySection title="Respect for Islamic learning">
        We aim to present Islamic educational material
        respectfully and with attention to reliable sources.
        Where a matter involves recognised scholarly
        differences, users should understand that Sahaba Quest
        is an educational platform and not a religious
        authority. Matters requiring a personal ruling should
        be referred to a qualified scholar.
      </PolicySection>

      <PolicySection title="Fair play">
        Users must not cheat, use bots or automated answering
        tools, exploit platform bugs, manipulate XP or
        leaderboards, impersonate another user, or interfere
        with another person's account or gameplay.
      </PolicySection>

      <PolicySection title="Sponsored competitions">
        Sponsored Competitions may have their own eligibility
        requirements, time limits, rules and prizes. Where a
        competition provides one attempt per player,
        completing or exhausting that attempt does not create a
        right to replay it. Sponsored XP is separate from
        normal Sahaba Quest XP.
      </PolicySection>

      <PolicySection title="Speed and Sponsored XP">
        Sponsored Competition scoring can consider both
        correct answers and how quickly those correct answers
        are submitted. A correct answer may therefore earn
        its base XP together with an additional speed bonus.
      </PolicySection>

      <PolicySection title="Subscriptions and payments">
        Premium features, subscription periods, prices and
        payment terms are shown through the relevant Sahaba
        Quest purchase flow. Access may change when a
        subscription expires or is otherwise no longer active.
      </PolicySection>

      <PolicySection title="Prohibited use">
        Users must not use Sahaba Quest for fraud, harassment,
        unlawful activity, malicious interference, abusive
        content, or conduct that undermines the safety and
        learning environment of the platform.
      </PolicySection>

      <PolicySection title="Changes and availability">
        We may update features, content or these terms as the
        platform develops. The service may also be temporarily
        unavailable because of maintenance, technical issues,
        security work or third-party service interruptions.
      </PolicySection>
    </>
  );
}

function SponsorshipContent() {
  return (
    <>
      <PolicySection title="Sponsor Sahaba Quest">
        Sahaba Quest gives Muslim organisations, businesses
        and brands an opportunity to support Islamic learning
        while reaching an audience interested in learning,
        family participation and knowledge competitions.
      </PolicySection>

      <PolicySection title="Sponsored competitions">
        Sponsors can support weekly or monthly Islamic
        knowledge competitions. A competition can display the
        sponsor's name, logo, competition information,
        announcements and prize details to participants.
      </PolicySection>

      <PolicySection title="What sponsorship supports">
        Sponsorship can help support competition prizes,
        educational initiatives, platform activities and
        opportunities that make Islamic learning more engaging
        for users.
      </PolicySection>

      <PolicySection title="Sponsor information">
        Sponsors are expected to provide accurate information
        about their organisation, products, services and any
        prizes they offer through a competition.
      </PolicySection>

      <PolicySection title="Platform standards">
        Sahaba Quest is a Muslim-focused educational platform.
        We may decline sponsorships that are inconsistent with
        our platform standards, including promotions involving
        gambling, pornography, intoxicants, fraudulent schemes,
        unlawful activity, or content unsuitable for our
        audience.
      </PolicySection>

      <PolicySection title="Interested in sponsoring?">
        Contact info@sahabaquest.com.ng or WhatsApp
        +234 906 047 9725 with your organisation name, the
        type of sponsorship you are interested in, and any
        relevant campaign or competition details.
      </PolicySection>
    </>
  );
}

function AdvertisingContent() {
  return (
    <>
      <PolicySection title="Advertise on Sahaba Quest">
        Sahaba Quest provides opportunities for relevant
        organisations and businesses to introduce their
        products or services to our Muslim audience through
        appropriate promotional formats.
      </PolicySection>

      <PolicySection title="Relevant advertising">
        Advertising opportunities may be suitable for Muslim
        businesses, Islamic organisations, educational
        services, halal businesses, Umrah-related services,
        publishers, family-oriented services and other
        organisations relevant to our audience.
      </PolicySection>

      <PolicySection title="Advertising standards">
        Advertisements must be accurate, respectful and
        appropriate for the Sahaba Quest audience. We may
        reject advertising that promotes gambling, pornography,
        intoxicants, fraudulent schemes, unlawful products or
        services, misleading claims, or content that is
        inappropriate for a family-oriented learning
        environment.
      </PolicySection>

      <PolicySection title="No automatic endorsement">
        The appearance of an advertisement or sponsor on
        Sahaba Quest does not by itself mean that Sahaba Quest
        or Deen Skyline Limited endorses every claim, product,
        service or religious position of the advertiser.
      </PolicySection>

      <PolicySection title="Advertising enquiries">
        For advertising enquiries, contact
        info@sahabaquest.com.ng or WhatsApp +234 906 047 9725.
        Please include your organisation, what you want to
        promote, and the type of placement or campaign you
        have in mind.
      </PolicySection>
    </>
  );
}

function PolicySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="policy-section">
      <h3>{title}</h3>
      <p>{children}</p>
    </section>
  );
}