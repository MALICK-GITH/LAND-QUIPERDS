/**
 * Wrapper autour de toast pour ajouter automatiquement des sons
 */
import { toast } from "sonner";
import { playSound } from "./sounds";

export const toastWithSound = {
  success: (message: string, ...args: any[]) => {
    playSound("win"); // Son unlock game pour les succès
    return toast.success(message, ...args);
  },
  error: (message: string, ...args: any[]) => {
    playSound("loss"); // Son game over pour les erreurs
    return toast.error(message, ...args);
  },
  info: (message: string, ...args: any[]) => {
    playSound("notification");
    return toast(message, ...args);
  },
  challenge: (message: string, ...args: any[]) => {
    playSound("challenge");
    return toast(message, ...args);
  },
  duel: (message: string, ...args: any[]) => {
    playSound("duel");
    return toast(message, ...args);
  },
  message: (message: string, ...args: any[]) => {
    playSound("message"); // Son glass hitting metal pour les messages
    return toast(message, ...args);
  },
  deposit: (message: string, ...args: any[]) => {
    playSound("win"); // Utilise le son de victoire pour les dépôts (événement positif)
    return toast.success(message, ...args);
  },
  withdrawal: (message: string, ...args: any[]) => {
    playSound("win"); // Utilise le son de victoire pour les retraits (événement positif)
    return toast.success(message, ...args);
  },
};