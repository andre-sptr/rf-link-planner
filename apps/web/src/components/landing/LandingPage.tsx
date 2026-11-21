import { useMemo, useState } from 'react';
import { DEMO_SCENARIOS } from '@linksight/rf-engine';
import '../../styles/landing.css';
import { ArchitectureAndCommunitySections } from './ArchitectureAndCommunitySections';
import { CapabilitiesAndRelaySections } from './CapabilitiesAndRelaySections';
import { HeroSection } from './HeroSection';
import { LandingNavbar } from './LandingNavbar';
import { evaluateLandingScenario } from './landingScenarios';

export interface LandingPageProps {
  onNavigate: (to: string) => void;
}

export function LandingPage({ onNavigate }: LandingPageProps) {
  const [activeHeroIdx, setActiveHeroIdx] = useState(0);

  const activeScenario = useMemo(() => {
    const preset = DEMO_SCENARIOS[activeHeroIdx] ?? DEMO_SCENARIOS[0]!;
    return evaluateLandingScenario(preset.id);
  }, [activeHeroIdx]);

  return (
    <div className="ls-landing">
      <LandingNavbar
        activeScenario={activeScenario}
        onNavigate={onNavigate}
      />

      <main>
        <HeroSection
          activeIdx={activeHeroIdx}
          onSelectIdx={setActiveHeroIdx}
          onNavigate={onNavigate}
        />

        <InteractiveShowcaseWrapper onNavigate={onNavigate} />

        <CapabilitiesAndRelaySections onNavigate={onNavigate} />

        <ArchitectureAndCommunitySections
          activeScenario={activeScenario}
          onNavigate={onNavigate}
        />
      </main>
    </div>
  );
}

import { InteractiveWorkbenchShowcase } from './InteractiveWorkbenchShowcase';

function InteractiveShowcaseWrapper({
  onNavigate,
}: {
  onNavigate: (to: string) => void;
}) {
  return <InteractiveWorkbenchShowcase onNavigate={onNavigate} />;
}

export default LandingPage;
