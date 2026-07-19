import {
  ExternalLinkIcon,
  GithubIcon,
  GlobeIcon,
  LinkedinIcon,
} from "@/components/icons";

interface AboutLink {
  readonly description: string;
  readonly href: string;
  readonly icon: "github" | "globe" | "linkedin";
  readonly label: string;
}

const LINKS: readonly AboutLink[] = [
  {
    description: "The full source for this project",
    href: "https://github.com/muhFaza/square-menu-explorer",
    icon: "github",
    label: "square-menu-explorer",
  },
  {
    description: "More of my work on GitHub",
    href: "https://github.com/muhFaza",
    icon: "github",
    label: "github.com/muhFaza",
  },
  {
    description: "Portfolio and contact",
    href: "http://muhammadfaza.com/",
    icon: "globe",
    label: "muhammadfaza.com",
  },
  {
    description: "Say hello on LinkedIn",
    href: "https://www.linkedin.com/in/mfaza/",
    icon: "linkedin",
    label: "linkedin.com/in/mfaza",
  },
];

function LinkIcon({ name }: { readonly name: AboutLink["icon"] }) {
  if (name === "github") {
    return <GithubIcon size={20} />;
  }
  if (name === "linkedin") {
    return <LinkedinIcon size={20} />;
  }
  return <GlobeIcon size={20} />;
}

export function AboutView() {
  return (
    <>
      <header className="menu-catalog__header">
        <p className="eyebrow">About</p>
        <h1>Square Menu Explorer</h1>
        <p>
          A mobile-first menu browser that reads live catalog and location data
          from Square, built by Muhammad Faza.
        </p>
      </header>

      <section className="about-section">
        <h2>Who built this</h2>
        <p className="about-prose">
          I&rsquo;m Muhammad Faza, a full-stack developer working across React,
          Node.js, and Django. I built this as a coding challenge for Per Diem,
          focusing on the parts that are easy to get wrong: correct Square
          catalog semantics, a keyboard-accessible interface, and a layout that
          holds up from 375px to desktop.
        </p>
      </section>

      <section className="about-section">
        <h2>Links</h2>
        <ul className="about-links">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                className="about-link"
                href={link.href}
                rel="noreferrer noopener"
                target="_blank"
              >
                <span aria-hidden="true" className="about-link__icon">
                  <LinkIcon name={link.icon} />
                </span>
                <span className="about-link__text">
                  <strong>{link.label}</strong>
                  <span>{link.description}</span>
                </span>
                {/* The arrow marks these as outbound so they don't read as
                    the static cards used elsewhere in the app. */}
                <span aria-hidden="true" className="about-link__arrow">
                  <ExternalLinkIcon size={16} />
                </span>
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="about-section">
        <h2>Thanks</h2>
        <ul className="about-credits">
          <li>
            <strong>Per Diem</strong> — for the challenge that shaped this
            project and the problem worth solving.
          </li>
          <li>
            <strong>Square</strong> — for the Catalog and Locations APIs, and
            the sandbox that made every state here testable.
          </li>
        </ul>
      </section>
    </>
  );
}
