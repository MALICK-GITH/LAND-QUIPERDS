import { useState, useCallback } from "react";
import { getSoundManager, type SoundSettings, type SoundType, type SoundPreset } from "@/lib/sounds";

export function useSounds() {
  const [settings, setSettings] = useState<SoundSettings>(() => getSoundManager().getSettings());

  const updateSettings = useCallback((newSettings: Partial<SoundSettings>) => {
    const manager = getSoundManager();
    manager.updateSettings(newSettings);
    setSettings(manager.getSettings());
  }, []);

  const playSound = useCallback((type: SoundType) => {
    const manager = getSoundManager();
    void manager.play(type);
  }, []);

  const previewSound = useCallback((type: SoundType) => {
    const manager = getSoundManager();
    void manager.preview(type);
  }, []);

  const resetSettings = useCallback(() => {
    const manager = getSoundManager();
    manager.reset();
    setSettings(manager.getSettings());
  }, []);

  const setPreset = useCallback((preset: SoundPreset) => {
    updateSettings({ preset });
  }, [updateSettings]);

  const setVolume = useCallback((volume: number) => {
    updateSettings({ volume: Math.max(0, Math.min(100, volume)) });
  }, [updateSettings]);

  const setEnabled = useCallback((enabled: boolean) => {
    updateSettings({ enabled });
  }, [updateSettings]);

  const setCustomSound = useCallback((type: SoundType, path: string) => {
    const manager = getSoundManager();
    const currentSettings = manager.getSettings();
    manager.updateSettings({
      customSounds: { ...currentSettings.customSounds, [type]: path },
      preset: "custom",
    });
    setSettings(manager.getSettings());
  }, []);

  return {
    settings,
    updateSettings,
    playSound,
    previewSound,
    resetSettings,
    setPreset,
    setVolume,
    setEnabled,
    setCustomSound,
  };
}