/**
 * Component label localization.
 *
 * Component setups and wear items store German labels in user data
 * (keys/ids are stable). These maps translate them at display time so
 * existing data renders localized without a migration.
 */

type TranslateFn = (key: string, options?: Record<string, any>) => string;

export const SETUP_LABEL_KEYS: Record<string, string> = {
    'Breite': 'tracker.setup_width',
    'Rise': 'tracker.setup_rise',
    'Backsweep': 'tracker.setup_backsweep',
    'Upsweep': 'tracker.setup_upsweep',
    'Scheibengröße': 'tracker.setup_rotor_size',
    'Hebelweite': 'tracker.setup_lever_reach',
    'Drehmoment Adapter': 'tracker.setup_adapter_torque',
    'Neigung': 'tracker.setup_tilt',
    'Höhe': 'tracker.setup_height',
    'Setback': 'tracker.setup_setback',
    'Hub': 'tracker.setup_drop',
    'Durchmesser': 'tracker.setup_diameter',
    'Drehmoment Klemme': 'tracker.setup_clamp_torque',
    'Drehmoment': 'tracker.setup_torque',
    'Plattformgröße': 'tracker.setup_platform',
    'Länge': 'tracker.setup_length',
    'Winkel': 'tracker.setup_angle',
    'Drehmoment Lenker': 'tracker.setup_bar_torque',
    'Drehmoment Steuerrohr': 'tracker.setup_headset_torque',
    'Offset': 'tracker.setup_offset',
    'Einbaulänge': 'tracker.setup_eye_to_eye',
    'Reifen': 'tracker.setup_tire',
    'Glieder': 'tracker.setup_links',
    'Typ': 'tracker.setup_chain_type',
    'Abstufung': 'tracker.setup_ratio',
    'Zähne': 'tracker.setup_teeth',
    'Max. Zähne': 'tracker.setup_max_teeth',
    'Kettenblatt': 'tracker.setup_chainring',
    'Kapazität': 'tracker.setup_capacity',
    'Ladezyklen': 'tracker.setup_charge_cycles',
    'Max. Drehmoment': 'tracker.setup_max_torque',
    'Leistung': 'tracker.setup_power',
};

/** Localized label for a stored setup-value key, or null when unknown. */
export function setupLabelLocalized(t: TranslateFn, key: string): string | null {
    const k = SETUP_LABEL_KEYS[key];
    return k ? t(k) : null;
}

export const WEAR_LABEL_KEYS: Record<string, string> = {
    pads: 'tracker.wear_pads',
    rotor: 'tracker.wear_rotor',
    fluid: 'tracker.wear_fluid',
    lower_leg: 'tracker.wear_lower_leg',
    full_service: 'tracker.wear_full_service',
    air_can: 'tracker.wear_air_can',
    chain: 'tracker.wear_chain',
    cassette: 'tracker.wear_cassette',
    tire: 'tracker.wear_tire',
    sealant: 'tracker.wear_sealant',
    jockey_wheels: 'tracker.wear_jockey',
    battery: 'tracker.wear_battery',
    motor: 'tracker.wear_motor',
    general: 'tracker.wear_general',
};

/** Localized label for a wear item (falls back to the stored label). */
export function wearLabelLocalized(t: TranslateFn, item: { id: string; label: string }): string {
    const k = WEAR_LABEL_KEYS[item.id];
    return k ? t(k) : item.label;
}
