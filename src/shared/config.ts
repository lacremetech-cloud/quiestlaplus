/**
 * Reglages de rythme du jeu, partages par le serveur et l'ecran hote
 * pour que le decompte affiche et la bascule serveur restent synchronises.
 */

/** Duree d'affichage de chaque chiffre du decompte 3-2-1, en millisecondes. */
export const COUNTDOWN_STEP_MS = 600;

/** Nombre de chiffres affiches avant la revelation. */
export const COUNTDOWN_STEPS = 3;

/**
 * Delai total entre le clic sur RÉVÉLER et l'affichage du resultat.
 * La petite marge evite que le resultat arrive avant la fin du dernier chiffre.
 */
export const COUNTDOWN_MS = COUNTDOWN_STEP_MS * COUNTDOWN_STEPS + 100;
