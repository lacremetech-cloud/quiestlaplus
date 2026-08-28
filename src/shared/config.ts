/**
 * Reglages de rythme du jeu, partages par le serveur et l'ecran hote
 * pour que le decompte affiche et la bascule serveur restent synchronises.
 *
 * Le decompte 3-2-1 ne sert QUE pour le grand final : entre deux questions
 * la revelation est immediate, sinon le rythme retombe a chaque fois.
 */

/** Duree d'affichage de chaque chiffre du decompte final, en millisecondes. */
export const COUNTDOWN_STEP_MS = 800;

/** Nombre de chiffres affiches avant l'ecran de fin. */
export const COUNTDOWN_STEPS = 3;

/**
 * Delai total entre la fin de la derniere question et l'ecran de statistiques.
 * La petite marge evite que l'ecran arrive avant la fin du dernier chiffre.
 */
export const COUNTDOWN_MS = COUNTDOWN_STEP_MS * COUNTDOWN_STEPS + 100;
