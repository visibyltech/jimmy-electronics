import React, { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISSED_KEY = 'jimmy_pwa_install_dismissed_until';

export const PwaInstallPrompt: React.FC = () => {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    if (isStandalone) return;

    const dismissedUntil = Number(localStorage.getItem(DISMISSED_KEY) || 0);
    if (dismissedUntil > Date.now()) return;

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
      setVisible(true);
    };

    const handleInstalled = () => {
      setVisible(false);
      setInstallEvent(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    // iPhone/iPad browsers do not expose beforeinstallprompt; provide manual instructions.
    const isAppleMobile = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    if (isAppleMobile) setVisible(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    setVisible(false);
  };

  const install = async () => {
    if (!installEvent) {
      setShowInstructions(true);
      return;
    }
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    if (choice.outcome === 'accepted') setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-4 z-[70] mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
      <div className="flex items-start gap-3">
        <img
          src="/assets/aistudio/file_00000000b84481f4b44d267e06ddd435_d937ff89.png"
          alt="Jimmy Electronics"
          className="h-12 w-12 rounded-xl border border-gray-100 object-contain"
        />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-[#141619]">Install Jimmy Electronics</p>
          <p className="mt-1 text-xs leading-5 text-gray-600">
            Add our store to your phone for quick access from your home screen.
          </p>
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss install prompt" className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
          <X className="h-4 w-4" />
        </button>
      </div>
      {showInstructions ? (
        <div className="mt-3 rounded-xl bg-gray-50 p-3 text-xs leading-5 text-gray-700">
          In your browser, tap the menu (⋮), then choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
          <button type="button" onClick={() => setShowInstructions(false)} className="ml-2 font-semibold text-[#DC2626]">Close</button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={install} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#DC2626] px-4 py-3 text-sm font-bold text-white hover:bg-[#B91C1C]">
            {installEvent ? <Download className="h-4 w-4" /> : <Share className="h-4 w-4" />}
            Install App
          </button>
          <button type="button" onClick={dismiss} className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700">
            Not now
          </button>
        </div>
      )}
    </div>
  );
};
