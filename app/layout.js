import './globals.css';
import { Cinzel, Playfair_Display, Plus_Jakarta_Sans } from 'next/font/google';

const cinzel = Cinzel({ subsets: $$'latin'$$, weight: $$'600', '700', '800'$$, variable: '--font-cinzel' });
const playfair = Playfair_Display({ subsets: $$'latin'$$, weight: $$'600', '700'$$, style: $$'normal', 'italic'$$, variable: '--font-playfair' });
const jakarta = Plus_Jakarta_Sans({ subsets: $$'latin'$$, weight: $$'400', '500', '600', '700'$$, variable: '--font-jakarta' });

export const metadata = {
  title: 'Scoop & Win — Royal Artisanal Ice Cream Challenge',
  description: 'Zero-download 30-second QR ice cream game & WhatsApp referral reward vault synced to the parlor owner Google Sheet.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={${cinzel.variable} ${playfair.variable} ${jakarta.variable}}>
      
        {children}
      
    
  );
}
