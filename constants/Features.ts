/**
 * Feature registry for the BikePro app.
 * Each feature corresponds to one Agent manifest and one tile on the homescreen.
 */

export interface Feature {
    id: string;
    title: string;
    subtitle: string;
    icon: string; // emoji for now, can swap to icon lib later
    route: string;
    accentColor: string;
    ready: boolean; // false = "Coming Soon" badge
}

export const features: Feature[] = [
    {
        id: 'dialed-in',
        title: 'Dialed In',
        subtitle: 'Fahrwerks-Log',
        icon: '⚙️',
        route: '/(features)/dialed-in',
        accentColor: '#FF6B2C',
        ready: true,
    },
    {
        id: 'shred-check',
        title: 'Shred Check',
        subtitle: 'Wear & Tear Tracker',
        icon: '🔧',
        route: '/(features)/shred-check',
        accentColor: '#FF5252',
        ready: true,
    },
    {
        id: 'park-picker',
        title: 'Park Picker',
        subtitle: 'Bikepark-Aggregator',
        icon: '🏔️',
        route: '/(features)/park-picker',
        accentColor: '#A8E10C',
        ready: true,
    },
    {
        id: 'trail-video',
        title: 'Trail Video',
        subtitle: 'Edits of the Week',
        icon: '🎬',
        route: '/(features)/trail-video',
        accentColor: '#00E5FF',
        ready: true,
    },
    {
        id: 'jump-analyzer',
        title: 'Jump Analyzer',
        subtitle: 'Airtime & Stil',
        icon: '🚀',
        route: '/(features)/jump-analyzer',
        accentColor: '#FF2D78',
        ready: false,
    },
    {
        id: 'pressure-bot',
        title: 'Pressure Bot',
        subtitle: 'Reifendruck-Rechner',
        icon: '💨',
        route: '/(features)/pressure-bot',
        accentColor: '#FFD600',
        ready: true,
    },
    {
        id: 'ride-log',
        title: 'Ride Log',
        subtitle: 'Dein Fahrtenbuch',
        icon: '📖',
        route: '/(features)/ride-log',
        accentColor: '#B388FF',
        ready: true,
    },
    {
        id: 'gps-tracker',
        title: 'Track & Trace',
        subtitle: 'GPS Tracker',
        icon: '📍',
        route: '/(features)/gps-tracker',
        accentColor: '#448AFF',
        ready: false,
    },
    {
        id: 'component-tracker',
        title: 'Component Tracker',
        subtitle: 'Gear & Setups',
        icon: '🔩',
        route: '/(features)/component-tracker',
        accentColor: '#26A69A',
        ready: true,
    },
    {
        id: 'setup-guide',
        title: 'Setup Guide',
        subtitle: 'MTB Setup Wiki',
        icon: '📚',
        route: '/(features)/setup-guide',
        accentColor: '#7C4DFF',
        ready: true,
    },
];
