// Footer with the hobby-project disclaimer and data credits.

export default function SiteFooter() {
  return (
    <footer className="site-footer" id="about">
      <div className="disclaimer">
        <p className="disclaimer-title">
          <span className="tag-pill">hobby project</span> Please read
        </p>
        <p>
          Car Service Reminder is a personal hobby project built for learning. It isn&apos;t affiliated with any
          automaker, dealership, repair shop or government agency, and it isn&apos;t professional, safety or legal
          advice.
        </p>
        <ul>
          <li>
            Maintenance schedules are general guidance for any car. Your owner&apos;s manual and a qualified mechanic
            come first.
          </li>
          <li>
            Ratings, recalls, complaints and service bulletins come from NHTSA and may be incomplete or out of date.
            For a recall check by VIN, use{" "}
            <a href="https://www.nhtsa.gov/recalls" target="_blank" rel="noopener noreferrer">
              nhtsa.gov/recalls
            </a>
            .
          </li>
          <li>Nearby shops come from OpenStreetMap community data and may be wrong, moved or closed.</li>
          <li>
            Answers in &ldquo;Ask a question&rdquo; are AI-generated from a small set of guides and the web. They can
            be wrong, so verify anything that matters.
          </li>
        </ul>
        <p>Provided as is, without warranty of any kind.</p>
      </div>

      <div className="footer-line">
        <span>Built by Bharadwaj Ravipati as part of an AI learning journey.</span>
        <nav className="footer-links" aria-label="Footer">
          <a href="https://github.com/bravipat/car-service-app" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a href="https://www.nhtsa.gov/nhtsa-datasets-and-apis" target="_blank" rel="noopener noreferrer">
            NHTSA data
          </a>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
            © OpenStreetMap
          </a>
          <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener noreferrer">
            © Mapbox
          </a>
        </nav>
      </div>
    </footer>
  );
}
