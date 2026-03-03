/**
 * F10: Setup Guide — MTB Setup Wiki
 * Agent Manifest: f10_setup_guide.md
 *
 * Umfassendes Wiki mit Fachbegriffen, Anleitungen, empfohlenen Werten.
 * Kategorien: Cockpit, Fahrwerk, Bremsen, Antrieb, Laufräder, Geometrie, Ergonomie
 * Daten: Statische JSON-Struktur, lokal gebündelt
 */
import { BPCard } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { Stack } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const ACCENT = '#7C4DFF';

// --- Wiki Data Structure ---
interface WikiArticle {
    id: string;
    title: string;
    category: string;
    tags: string[];
    summary: string;
    content: string; // multi-line detail
    values?: string; // recommended values
    tip?: string;
}

interface WikiCategory {
    id: string;
    emoji: string;
    title: string;
    description: string;
}

const categories: WikiCategory[] = [
    { id: 'cockpit', emoji: '🔩', title: 'Cockpit', description: 'Lenker, Vorbau, Griffe' },
    { id: 'fahrwerk', emoji: '🔱', title: 'Fahrwerk', description: 'Gabel, Dämpfer, Setup' },
    { id: 'bremsen', emoji: '🛑', title: 'Bremsen', description: 'Scheiben, Beläge, Entlüften' },
    { id: 'antrieb', emoji: '⛓️', title: 'Antrieb', description: 'Kette, Kassette, Schaltung' },
    { id: 'laufraeder', emoji: '🛞', title: 'Laufräder', description: 'Speichen, Tubeless, Reifen' },
    { id: 'geometrie', emoji: '📐', title: 'Geometrie', description: 'Stack, Reach, Lenkwinkel' },
    { id: 'ergonomie', emoji: '🪑', title: 'Ergonomie', description: 'Sattel, Position, Griffe' },
];

const articles: WikiArticle[] = [
    // --- Cockpit ---
    {
        id: 'backsweep',
        title: 'Backsweep',
        category: 'cockpit',
        tags: ['lenker', 'ergonomie', 'winkel'],
        summary: 'Rückwärtsneigung des Lenkers in Grad.',
        content: 'Der Backsweep beschreibt den Winkel, um den die Lenkerenden nach hinten (zum Fahrer hin) gebogen sind. Ein höherer Backsweep sorgt für eine natürlichere Handgelenkposition und kann Ermüdung reduzieren.',
        values: 'Typisch: 4°–9°. Race: 4–5°, Enduro/DH: 7–9°',
        tip: 'Ein höherer Backsweep (8-9°) ist besonders bei langen Abfahrten angenehmer fürs Handgelenk.',
    },
    {
        id: 'upsweep',
        title: 'Upsweep',
        category: 'cockpit',
        tags: ['lenker', 'winkel'],
        summary: 'Aufwärtsneigung der Lenkerenden.',
        content: 'Der Upsweep ist der Winkel, um den die Lenkerenden nach oben gebogen sind. Er beeinflusst die Armposition und das Gefühl beim Fahren.',
        values: 'Typisch: 4°–6°',
    },
    {
        id: 'rise',
        title: 'Rise',
        category: 'cockpit',
        tags: ['lenker', 'höhe'],
        summary: 'Höhenunterschied zwischen Klemmung und Lenkerenden.',
        content: 'Der Rise gibt an, wie viel Millimeter die Lenkerenden höher liegen als die Klemmstelle am Vorbau. Mehr Rise = aufrechte Sitzposition.',
        values: 'Flat: 0mm, Low Rise: 10-20mm, High Rise: 25-38mm',
    },
    {
        id: 'lenkerbreite',
        title: 'Lenkerbreite',
        category: 'cockpit',
        tags: ['lenker', 'breite', 'mm'],
        summary: 'Gesamtbreite des Lenkers.',
        content: 'Die Lenkerbreite beeinflusst Kontrolle und Hebel. Breitere Lenker = mehr Kontrolle in ruppigem Gelände, aber schwerer zu manövrieren in engen Trails. Abhängig von Schulterbreite und Fahrweise anpassen.',
        values: 'Typisch: 760–800mm. DH: 780–810mm. Trail: 740–780mm',
        tip: 'Tipp: Faustregel ist Schulterbreite + 2 cm je Seite. Lieber breiter kaufen und kürzen.',
    },
    {
        id: 'vorbau',
        title: 'Vorbau (Stem)',
        category: 'cockpit',
        tags: ['vorbau', 'länge', 'winkel'],
        summary: 'Verbindung zwischen Steuerrohr und Lenker.',
        content: 'Die Vorbaulänge beeinflusst das Lenkverhalten direkt. Kürzere Vorbauten (30–50mm) sind agiler und besser für DH/Enduro. Längere Vorbauten stabilisieren, sind aber weniger direkt.',
        values: 'DH: 30–40mm, Enduro: 40–50mm, Trail: 50–70mm. Winkel: 0° bis -6°',
    },
    // --- Fahrwerk ---
    {
        id: 'sag',
        title: 'SAG (Negativfederweg)',
        category: 'fahrwerk',
        tags: ['gabel', 'dämpfer', 'setup', 'federweg'],
        summary: 'Einfederung unter Fahrergewicht in Ruheposition.',
        content: 'Der SAG ist der Prozentsatz des Federwegs, den Gabel/Dämpfer unter dem Körpergewicht des Fahrers einfedern. Er ist die Basis jedes Fahrwerks-Setups und muss zuerst eingestellt werden, bevor Rebound und Compression angepasst werden.',
        values: 'Gabel: 15–20% (DH), 20–25% (Enduro/Trail). Dämpfer: 25–30% (DH), 30–35% (Enduro)',
        tip: 'Immer in voller Fahrermontur messen und O-Ring am Standrohr nutzen.',
    },
    {
        id: 'rebound',
        title: 'Rebound (Zugstufe)',
        category: 'fahrwerk',
        tags: ['gabel', 'dämpfer', 'setup', 'klicks'],
        summary: 'Geschwindigkeit, mit der das Fahrwerk ausfedert.',
        content: 'Der Rebound kontrolliert, wie schnell Gabel/Dämpfer nach einer Kompression in die Ausgangsposition zurückkehren. Zu schneller Rebound = "Kicking" (Bike schmeißt dich raus). Zu langsamer Rebound = "Packing" (Federweg wird aufgebraucht).',
        values: 'Faustregel: Auf einen Bordstein fahren, Bike soll in 1 Bounce zurückkommen.',
        tip: 'Für DH: Eher etwas langsamer (mehr Klicks zu). Für Jumps: Eher etwas schneller.',
    },
    {
        id: 'compression',
        title: 'Compression (Druckstufe)',
        category: 'fahrwerk',
        tags: ['gabel', 'dämpfer', 'setup', 'klicks', 'hsc', 'lsc'],
        summary: 'Widerstand gegen Einfederung.',
        content: 'Low-Speed Compression (LSC): Kontrolliert langsame Einfeder-Bewegungen (Wippen, Bremstauchen). High-Speed Compression (HSC): Kontrolliert schnelle Schläge (Wurzeln, Drops). Nicht jede Gabel hat beides.',
        values: 'LSC: Startpunkt Mitte, dann anpassen. HSC: Wenige Klicks zu, dann teste auf ruppigem Trail.',
    },
    {
        id: 'tokens',
        title: 'Volume Spacer / Tokens',
        category: 'fahrwerk',
        tags: ['gabel', 'dämpfer', 'luftkammer', 'progression'],
        summary: 'Verkleinern die Luftkammer für mehr Endprogression.',
        content: 'Tokens/Spacer reduzieren das Volumen der Luftkammer. Dadurch steigt der Druck gegen Ende des Federwegs stärker an (progressiveres Kennlinie). Das verhindert Durchschläge, macht das Fahrwerk aber im mittleren Bereich "straffer".',
        values: 'DH/schwere Fahrer: 2–3 Tokens. Trail/leichte Fahrer: 0–1 Token',
        tip: 'Erst SAG und Rebound einstellen, dann Tokens anpassen wenn du Durchschläge hast.',
    },
    // --- Bremsen ---
    {
        id: 'bremsscheiben',
        title: 'Bremsscheiben-Größe',
        category: 'bremsen',
        tags: ['bremse', 'scheibe', 'mm'],
        summary: 'Durchmesser der Bremsscheibe beeinflusst Bremspower.',
        content: 'Größere Scheiben = mehr Bremskraft und bessere Wärmeableitung bei langen Abfahrten. Standard-Größen: 160mm (hinten leicht), 180mm (Standard), 200mm (DH vorne), 203mm+ (Gravity).',
        values: 'Vorne: 180–203mm. Hinten: 160–180mm. DH: Vorne 200+, Hinten 180+',
    },
    {
        id: 'bremsbelag',
        title: 'Organisch vs. Sinter Beläge',
        category: 'bremsen',
        tags: ['bremse', 'belag', 'sinter', 'organisch'],
        summary: 'Zwei Belagtypen mit unterschiedlichen Eigenschaften.',
        content: 'Organische Beläge: Leiser, bessere Modulation, verschleißen schneller, besonders bei Nässe. Sinter-Beläge (Metall): Lauter, aggressiver Biss, langlebiger, besser bei Nässe und Matsch. Für DH und Bikeparks werden Sinter empfohlen.',
        tip: 'Nie organische und Sinter-Beläge mischen! Scheibe muss bei Wechsel gereinigt werden.',
    },
    // --- Antrieb ---
    {
        id: 'kettenverschleiss',
        title: 'Kettenverschleiß messen',
        category: 'antrieb',
        tags: ['kette', 'verschleiß', 'messung'],
        summary: 'Wann muss die Kette gewechselt werden?',
        content: 'Eine verschlissene Kette zerstört Kassette und Kettenblatt. Mit einer Kettenmesslehre den Verschleiß prüfen. Ab 0.5% Längung: Kette wechseln. Ab 0.75%: Kassette gleich mit tauschen.',
        values: '0.5% = Kette tauschen. 0.75% = Kette + Kassette. 1.0% = Alles neu.',
        tip: 'Alle 100–200km die Kette schmieren, besonders nach Regenfahrten.',
    },
    {
        id: 'schaltauge',
        title: 'Schaltauge',
        category: 'antrieb',
        tags: ['schaltung', 'schaltauge', 'ausrichtung'],
        summary: 'Sollbruchstelle zwischen Rahmen und Schaltwerk.',
        content: 'Das Schaltauge ist eine Opferkomponente, die den Rahmen bei einem Sturz schützt. Ein verbogenes Schaltauge führt zu ungenauen Schaltung und kann die Kette in die Speichen werfen. Muss exakt gerade sein.',
        tip: 'Immer ein Ersatzschaltauge im Rucksack haben! Rahmenspezifisch bestellen.',
    },
    // --- Laufräder ---
    {
        id: 'tubeless',
        title: 'Tubeless Setup',
        category: 'laufraeder',
        tags: ['tubeless', 'reifen', 'dichtmilch'],
        summary: 'Reifen ohne Schlauch mit Dichtmilch.',
        content: 'Tubeless-Setups erlauben niedrigeren Reifendruck (mehr Grip), sind pannensicherer (Dichtmilch schließt kleine Löcher) und leichter. Benötigt Tubeless-Ready Felgen, spezielle Felgenbänder, Ventile und Dichtmilch.',
        values: 'Dichtmilch: 60–90ml pro Reifen. Alle 3–6 Monate nachfüllen.',
        tip: 'Kompressor oder Booster-Pumpe zum erstmaligen Aufpumpen verwenden.',
    },
    // --- Geometrie ---
    {
        id: 'reach',
        title: 'Reach',
        category: 'geometrie',
        tags: ['geometrie', 'reach', 'rahmengröße'],
        summary: 'Horizontale Distanz Tretlager → Steuerrohroberkante.',
        content: 'Der Reach ist der wichtigste Wert bei der Rahmenwahl. Er bestimmt, wie gestreckt du auf dem Bike sitzt. Zu kurzer Reach = eingezwängtes Gefühl, zu langer = zu gestreckt.',
        values: 'S: 430–450mm, M: 450–470mm, L: 470–490mm, XL: 490–510mm',
        tip: 'Reach ist wichtiger als rechnerische Rahmengröße. Immer auf den Reach achten!',
    },
    {
        id: 'lenkwinkel',
        title: 'Lenkwinkel (Head Angle)',
        category: 'geometrie',
        tags: ['geometrie', 'lenkwinkel', 'steering'],
        summary: 'Winkel des Steuerrohrs zur Senkrechten.',
        content: 'Flacherer Lenkwinkel = stabilere, ruhigere Front bei hoher Geschwindigkeit. Steilerer Lenkwinkel = agiler und direkter. DH-Bikes: 62–64°, Enduro: 64–66°, Trail: 65–67°.',
        values: 'DH: 62–64°. Enduro: 64–66°. Trail: 65–67°. XC: 67–69°',
    },
    {
        id: 'stack',
        title: 'Stack',
        category: 'geometrie',
        tags: ['geometrie', 'stack'],
        summary: 'Vertikale Distanz Tretlager → Steuerrohroberkante.',
        content: 'Der Stack beeinflusst, wie hoch die Front des Bikes ist. Höherer Stack = aufrechtere Position. Zusammen mit dem Reach bestimmt er die grundsätzliche Sitzposition.',
        values: 'Typisch: 600–640mm je nach Rahmengröße',
    },
    // --- Ergonomie ---
    {
        id: 'sattelhoehe',
        title: 'Sattelhöhe',
        category: 'ergonomie',
        tags: ['sattel', 'höhe', 'dropper'],
        summary: 'Korrekte Sattelhöhe für effizientes Pedalieren.',
        content: 'Die Sattelhöhe wird gemessen von der Tretlagermitte bis zur Sattelhöhe. Bei ausgestrecktem Bein und Ferse auf dem Pedal sollte das Knie gerade durchgestreckt sein. Mit dem Fußballen auf dem Pedal sollte eine leichte Beugung bleiben.',
        values: 'Formel: Schrittlänge × 0.885 = Sattelhöhe ab Tretlager',
        tip: 'Mit Dropper-Post fährst du bergab mit abgesenktem Sattel — aber die Maximalhöhe muss stimmen!',
    },
    {
        id: 'griffweite',
        title: 'Griffweite & Ergonomie',
        category: 'ergonomie',
        tags: ['griffe', 'ergonomie', 'bremshebel'],
        summary: 'Einstellung der Brems- und Schalthebel am Lenker.',
        content: 'Die Bremshebel sollten so eingestellt sein, dass du sie mit einem Finger (Zeigefinger) bedienen kannst, ohne die Handposition zu verändern. Schalthebel sollten ohne Umgreifen erreichbar sein. Winkel der Hebel ca. 10° unter der Horizontalen.',
        tip: 'One-Finger-Braking: Nur den Zeigefinger am Bremshebel, der Rest greift den Lenker.',
    },
    // --- Neue Bremsen-Artikel ---
    {
        id: 'bremsen_entlueften',
        title: 'Bremsen entlüften',
        category: 'bremsen',
        tags: ['bremse', 'entlüften', 'dot', 'mineralöl', 'wartung'],
        summary: 'Luft aus dem Bremssystem entfernen.',
        content: 'Luft im Bremssystem führt zu einem schwammigen Griff und verringerter Bremskraft. Shimano: Mineralöl, Spritze + Entlüftungskit. SRAM/Avid: DOT 5.1 Bremsflüssigkeit. DOT-Fluid ist hygroskopisch — jährlich wechseln.',
        values: 'Shimano: Mineralöl (alle 1-2 Jahre). SRAM: DOT 5.1 (jährlich). Magura: Royal Blood',
        tip: 'Niemals DOT auf Lack oder Carbonteile tropfen — aggressive Chemikalie!',
    },
    {
        id: 'bremsleitung',
        title: 'Bremsleitung kürzen',
        category: 'bremsen',
        tags: ['bremse', 'leitung', 'kürzen'],
        summary: 'Zu lange Bremsleitungen können Performance kosten.',
        content: 'Eine zu lange Bremsleitung erzeugt mehr "Totwasser" und kann das Bremsgefühl verschlechtern. Im Idealfall ist die Leitung so kurz wie möglich, aber lang genug, dass der Lenker frei einschlagen kann.',
        tip: 'Nach dem Kürzen immer entlüften! Olive und Stützhülse erneuern.',
    },
    {
        id: 'brake_bedding',
        title: 'Bremsen einbremsen',
        category: 'bremsen',
        tags: ['bremse', 'einbremsen', 'belag', 'scheibe'],
        summary: 'Neue Beläge und Scheiben müssen eingebremst werden.',
        content: 'Beim Einbremsen wird Belagmaterial auf die Scheibe übertragen (Transferschicht). Ohne Einbremsen ist die Bremspower mangelhaft. Methode: 10x von ~30 km/h auf ~5 km/h abbremsen (nicht zum Stillstand!), dann langsam steigern.',
        tip: 'Scheibe und Belag NIE mit Fingern berühren — Fett vernichtet die Bremswirkung.',
    },
    // --- Mehr Antrieb ---
    {
        id: 'kettenlinie',
        title: 'Kettenlinie (Chainline)',
        category: 'antrieb',
        tags: ['kette', 'kettenlinie', 'kettenblatt', 'chainline'],
        summary: 'Optimale Ausrichtung der Kette zwischen Kettenblatt und Kassette.',
        content: 'Die Kettenlinie beschreibt den Versatz der Kette von der Rahmenmitte. Bei 1x-Antrieben sollte die Kettenlinie so eingestellt sein, dass die Kette im mittleren Bereich der Kassette am geradesten läuft. Falsche Kettenlinie = mehr Verschleiß und Kettenabwurf.',
        values: 'Boost: 52mm. Non-Boost: 49mm. Super Boost: 56.5mm',
    },
    {
        id: 'kettenblatt_groesse',
        title: 'Kettenblattgröße wählen',
        category: 'antrieb',
        tags: ['kettenblatt', 'zähne', 'übersetzung'],
        summary: 'Welche Kettenblattgröße für welchen Einsatz?',
        content: 'Ein kleineres Kettenblatt = leichtere Gänge (besser bergauf). Größeres Kettenblatt = höhere Maximalgeschwindigkeit. E-MTBs fahren oft kleinere Kettenblätter (34T), da der Motor hilft. Enduro ohne Motor: 30-34T. DH: 34-36T.',
        values: 'E-MTB: 32-36T. Enduro: 30-34T. DH: 34-36T. Trail: 30-32T. XC: 32-36T',
        tip: 'Shimano und SRAM haben unterschiedliche Direct-Mount-Standards!',
    },
    {
        id: 'kettenlaenge',
        title: 'Kettenlänge bestimmen',
        category: 'antrieb',
        tags: ['kette', 'länge', 'glieder'],
        summary: 'Die richtige Kettenlänge berechnen.',
        content: 'Kette über größtes Ritzel und größtes Kettenblatt legen (ohne Schaltwerk), dann 2 Glieder addieren. Alternative: Shimano-Methode über den Markierungsstift. Zu kurz = Schaltwerk reißt ab. Zu lang = Kette schlägt.',
        tip: 'Bei Fullys immer im voll eingefederten Zustand prüfen — Kettenstrebenlänge ändert sich!',
    },
    // --- Mehr Laufräder ---
    {
        id: 'reifendruck_grundlagen',
        title: 'Reifendruck-Grundlagen',
        category: 'laufraeder',
        tags: ['reifen', 'druck', 'bar', 'psi'],
        summary: 'Warum ist der Reifendruck so wichtig?',
        content: 'Der Reifendruck ist die günstigste und effektivste Setup-Änderung. Weniger Druck = mehr Aufstandsfläche = mehr Grip, aber auch höheres Risiko für Durchschläge und Reifenabruller. Optimal: So wenig wie möglich, so viel wie nötig.',
        values: 'Tubeless: VR 1.5-2.0 bar, HR 1.7-2.2 bar. Schlauch: +0.2-0.3 bar',
        tip: 'Nutze den Pressure-Bot (Feature 6) für deine individuelle Empfehlung!',
    },
    {
        id: 'reifenwahl',
        title: 'Reifenwahl VR / HR',
        category: 'laufraeder',
        tags: ['reifen', 'profil', 'vorderrad', 'hinterrad'],
        summary: 'Vorne aggressiv, hinten rollend — die goldene Regel.',
        content: 'Das Vorderrad hat weniger Gewicht und braucht maximalen Grip (Lenkung!). Das Hinterrad trägt mehr Gewicht und sollte besser rollen. Klassische Kombi: Maxxis Assegai (VR) + Maxxis Minion DHR II (HR). Oder: Schwalbe Magic Mary (VR) + Schwalbe Big Betty (HR).',
        tip: 'Im Matsch: Aggressiveres Profil auch hinten (z.B. Assegai VR + HR).',
    },
    {
        id: 'felgenbreite',
        title: 'Felgeninnenweite',
        category: 'laufraeder',
        tags: ['felge', 'innenweite', 'reifen', 'mm'],
        summary: 'Die Felgenbreite beeinflusst den Reifenquerschnitt.',
        content: 'Eine breitere Felge zieht den Reifen breiter auf und verbessert die Seitenstabilität bei niedrigem Druck. Optimale Abstimmung zwischen Reifenbreite und Felgeninnenweite ist wichtig.',
        values: '2.3-2.4": 28-30mm Innenweite. 2.5-2.6": 30-35mm. DH: 30-35mm',
    },
    // --- Mehr Geometrie ---
    {
        id: 'tretlagerhoehe',
        title: 'Tretlagerhöhe (BB Height)',
        category: 'geometrie',
        tags: ['geometrie', 'tretlager', 'bb', 'bodenfreiheit'],
        summary: 'Höhe des Tretlagers über dem Boden.',
        content: 'Die Tretlagerhöhe beeinflusst den Schwerpunkt und die Bodenfreiheit. Niedrigeres Tretlager = tieferer Schwerpunkt = mehr Stabilität, aber auch höheres Risiko für Pedalaufsetzer. Moderne Enduro/DH-Bikes: meist 335-345mm.',
        values: 'DH: 335-345mm. Enduro: 340-350mm. Trail: 340-355mm',
        tip: 'Oft als "BB Drop" angegeben: Differenz zwischen Achsmitte und Tretlagermitte.',
    },
    {
        id: 'radstand',
        title: 'Radstand (Wheelbase)',
        category: 'geometrie',
        tags: ['geometrie', 'radstand', 'stabilität'],
        summary: 'Abstand zwischen Vorder- und Hinterachse.',
        content: 'Längerer Radstand = mehr Stabilität bei hoher Geschwindigkeit, aber weniger wendig. Kürzerer Radstand = agiler im Wald, aber nervöser auf schnellen Passagen. Moderne Bikes werden tendenziell länger.',
        values: 'DH (Gr. L): 1260-1300mm. Enduro: 1230-1270mm. Trail: 1200-1250mm',
    },
    {
        id: 'kettenstrebe',
        title: 'Kettenstrebenlänge',
        category: 'geometrie',
        tags: ['geometrie', 'kettenstrebenlänge', 'hinterbau'],
        summary: 'Distanz Tretlagermitte → Hinterachse.',
        content: 'Kürzere Kettenstrebe = spritzigeres Hinterrad, leichter zum Manual. Längere Kettenstrebe = mehr Traktion und Stabilität. Modernes Enduro: 435-445mm. DH: 440-455mm.',
        values: 'Trail: 425-435mm. Enduro: 435-445mm. DH: 440-455mm',
    },
    // --- Mehr Ergonomie ---
    {
        id: 'fussposition',
        title: 'Fußposition auf dem Pedal',
        category: 'ergonomie',
        tags: ['pedale', 'fußposition', 'technik'],
        summary: 'Wo steht der Fuß optimal auf dem Pedal?',
        content: 'Der Fußballen sollte zentriert über der Pedalachse stehen. Ferse leicht gesenkt (Attacke-Position). Zu weit vorne = weniger Kontrolle. Zu weit hinten = Fuß rutscht ab. Bei Flatpedals: Schuhsohle mit Grip-Pins des Pedals verzahnen.',
        tip: 'Fersen runter! Die wichtigste Grundposition beim MTB-Fahren.',
    },
    {
        id: 'koerperposition',
        title: 'Grundposition (Attack Position)',
        category: 'ergonomie',
        tags: ['technik', 'position', 'grundhaltung'],
        summary: 'Die richtige Grundhaltung auf dem Rad.',
        content: 'Arme und Beine leicht gebeugt, Ellbogen nach außen, Fersen runter, Blick voraus (~3-5 Meter), Zeigefinger an der Bremse. Gewicht zentral. Diese Position ist die Basis für alle Fahrsituationen auf dem Trail.',
        tip: 'Übe diese Position bis sie automatisch sitzt — sie ist der Schlüssel zu gutem MTB-Fahren!',
    },
];

export default function SetupGuideScreen() {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedArticle, setExpandedArticle] = useState<string | null>(null);

    const filteredArticles = useMemo(() => {
        let result = articles;
        if (selectedCategory) {
            result = result.filter((a) => a.category === selectedCategory);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                (a) =>
                    a.title.toLowerCase().includes(q) ||
                    a.summary.toLowerCase().includes(q) ||
                    a.tags.some((t) => t.includes(q))
            );
        }
        return result;
    }, [selectedCategory, searchQuery]);

    const toggleArticle = (id: string) => {
        setExpandedArticle(expandedArticle === id ? null : id);
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: '📚 Setup Guide',
                    headerStyle: { backgroundColor: theme.colors.surface },
                    headerTintColor: theme.colors.text,
                }}
            />
            <StatusBar barStyle="light-content" />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Search bar */}
                <View style={styles.searchWrap}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Suche… z.B. Backsweep, SAG, Tubeless"
                        placeholderTextColor={theme.colors.textMuted}
                        value={searchQuery}
                        onChangeText={(text) => {
                            setSearchQuery(text);
                            if (text.trim()) setSelectedCategory(null);
                        }}
                        selectionColor={ACCENT}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Text style={styles.clearBtn}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Category grid */}
                {!selectedCategory && !searchQuery && (
                    <View style={styles.categoryGrid}>
                        {categories.map((cat) => {
                            const count = articles.filter(a => a.category === cat.id).length;
                            return (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={styles.categoryCard}
                                    onPress={() => setSelectedCategory(cat.id)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.catEmoji}>{cat.emoji}</Text>
                                    <Text style={styles.catTitle}>{cat.title}</Text>
                                    <Text style={styles.catDesc}>{cat.description}</Text>
                                    <Text style={styles.catCount}>{count} Artikel</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* Category header with back */}
                {selectedCategory && (
                    <View style={styles.catHeaderRow}>
                        <TouchableOpacity onPress={() => setSelectedCategory(null)}>
                            <Text style={[styles.backBtn, { color: ACCENT }]}>← Kategorien</Text>
                        </TouchableOpacity>
                        <Text style={styles.catHeaderTitle}>
                            {categories.find(c => c.id === selectedCategory)?.emoji}{' '}
                            {categories.find(c => c.id === selectedCategory)?.title}
                        </Text>
                    </View>
                )}

                {/* Articles */}
                {filteredArticles.map((article) => {
                    const expanded = expandedArticle === article.id;
                    return (
                        <TouchableOpacity
                            key={article.id}
                            onPress={() => toggleArticle(article.id)}
                            activeOpacity={0.85}
                        >
                            <BPCard style={[styles.articleCard, expanded && styles.articleExpanded]}>
                                <View style={styles.articleHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.articleTitle}>{article.title}</Text>
                                        <Text style={styles.articleSummary}>{article.summary}</Text>
                                    </View>
                                    <Text style={styles.expandIcon}>{expanded ? '▼' : '▶'}</Text>
                                </View>

                                {expanded && (
                                    <View style={styles.articleBody}>
                                        <Text style={styles.bodyText}>{article.content}</Text>

                                        {article.values && (
                                            <View style={[styles.infoBox, { borderColor: ACCENT + '40' }]}>
                                                <Text style={styles.infoLabel}>📏 Empfohlene Werte</Text>
                                                <Text style={[styles.infoValue, { color: ACCENT }]}>
                                                    {article.values}
                                                </Text>
                                            </View>
                                        )}

                                        {article.tip && (
                                            <View style={[styles.infoBox, { borderColor: theme.colors.accentLime + '40' }]}>
                                                <Text style={styles.infoLabel}>💡 Tipp</Text>
                                                <Text style={[styles.infoValue, { color: theme.colors.accentLime }]}>
                                                    {article.tip}
                                                </Text>
                                            </View>
                                        )}

                                        <View style={styles.tagRow}>
                                            {article.tags.map((tag) => (
                                                <View key={tag} style={styles.tagChip}>
                                                    <Text style={styles.tagText}>#{tag}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                )}
                            </BPCard>
                        </TouchableOpacity>
                    );
                })}

                {filteredArticles.length === 0 && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>📚</Text>
                        <Text style={styles.emptyTitle}>Keine Artikel gefunden</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },

    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingHorizontal: theme.spacing.md,
        marginBottom: theme.spacing.lg,
    },
    searchIcon: { fontSize: 16, marginRight: 8 },
    searchInput: {
        flex: 1,
        color: theme.colors.text,
        fontSize: 15,
        paddingVertical: 14,
    },
    clearBtn: { color: theme.colors.textMuted, fontSize: 16, padding: 4 },

    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.lg,
    },
    categoryCard: {
        width: '48%',
        flexGrow: 1,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    catEmoji: { fontSize: 28, marginBottom: 6 },
    catTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
    catDesc: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
    catCount: { color: ACCENT, fontSize: 10, fontWeight: '700', marginTop: 6, textTransform: 'uppercase', letterSpacing: 1 },

    catHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.md },
    backBtn: { fontSize: 14, fontWeight: '700' },
    catHeaderTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },

    articleCard: { marginBottom: theme.spacing.sm, padding: theme.spacing.md },
    articleExpanded: { borderColor: ACCENT + '40', borderWidth: 1 },
    articleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    articleTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
    articleSummary: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 },
    expandIcon: { color: theme.colors.textMuted, fontSize: 12, marginTop: 4 },

    articleBody: { marginTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing.md },
    bodyText: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 22 },
    infoBox: { backgroundColor: theme.colors.elevated, borderRadius: theme.radius.md, padding: theme.spacing.sm, marginTop: theme.spacing.sm, borderWidth: 1 },
    infoLabel: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    infoValue: { fontSize: 13, fontWeight: '600', lineHeight: 20 },

    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: theme.spacing.md },
    tagChip: { backgroundColor: theme.colors.elevated, borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    tagText: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '600' },

    emptyState: { alignItems: 'center', paddingVertical: theme.spacing.xxl * 2 },
    emptyIcon: { fontSize: 48, marginBottom: theme.spacing.md },
    emptyTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '700' },
});
