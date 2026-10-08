import Image from "next/image";
import auGasitCocosul from "./art/au-gasit-cocosul.jpg";

/** The found-rooster moment, shown as a single framed illustration. */
export function LandingDiscovery() {
  return (
    <div className="landing-discovery" aria-hidden="true">
      <div className="landing-discovery__glow" />
      <div className="landing-discovery__frame">
        <Image
          className="landing-discovery__image"
          src={auGasitCocosul}
          alt=""
          width={1024}
          height={1024}
          sizes="(max-width: 899px) 92vw, 620px"
          style={{ width: "100%", height: "auto", display: "block" }}
        />
        <div className="landing-discovery__shine" />
      </div>
    </div>
  );
}
