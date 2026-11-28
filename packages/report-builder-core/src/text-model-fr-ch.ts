/**
 * The editor's words about a model, in Swiss French, a message for every
 * one text-model-en.ts has (0086). Swiss French puts a no-break space
 * before a colon and inside guillemets.
 */
import type { ModelCatalogue } from './text-en.js'

/** A no-break space: French puts one before a colon, so the colon never starts a line. */
const NB = ' '

export const MODEL_FR_CH: ModelCatalogue = {
  'translation.ask': `Demander à un modèle les mots manquants${NB}: {count}`,
  'translation.stop': 'Arrêter la demande',
  'translation.heading': `Traduction en {language} d’un modèle, mots à examiner${NB}: {count}`,
  'translation.where': 'Où il figure',
  'translation.accepted': 'Accepté',
  'translation.acceptOne': `Accepter «${NB}{text}${NB}» pour «${NB}{source}${NB}»`,
  'translation.acceptAll': 'Tout accepter',
  'translation.apply': `Appliquer les mots acceptés${NB}: {count}`,
  'translation.discard': 'Abandonner',
  'translation.reviewAgain': 'Examiner de nouveau',
  'translation.quoted': `«${NB}{text}${NB}»`,
  'history.translate': `Traduction de mots en {language}${NB}: {count}`,

  'translation.status.asking': 'Un modèle est interrogé sur les mots qui manquent en {language}, et sa réponse vérifiée.',
  'translation.status.elsewhereAsking': 'Un modèle traduit en {language}. Choisissez {language} pour suivre la demande, ou l’arrêter.',
  'translation.status.elsewhereHeld':
    'La traduction en {language} d’un modèle attend d’être examinée. Choisissez {language} pour l’examiner. Rien n’a été appliqué.',
  'translation.status.removed': 'La langue {language} a été retirée du rapport, avec la traduction qu’un modèle en faisait. Rien n’a été appliqué.',
  'translation.status.stale': `Non appliqué${NB}: le rapport a changé depuis la réponse du modèle. Examinez de nouveau pour lire sa réponse face au rapport tel qu’il est maintenant.`,
  'translation.status.notApplied': `Non appliqué${NB}: {reason}`,
  'translation.status.ready': `Mots à examiner${NB}: {count}. Rien n’a été appliqué.`,
  'translation.status.stillMissing': `Une fois tous appliqués, mots encore manquants${NB}: {count}.`,
  'translation.status.none': 'Le modèle n’a traduit aucun mot. Rien n’a été appliqué.',
  'translation.status.noneHeld': `Le modèle a écrit des mots, et aucun ne peut être appliqué${NB}: chacun figure ci-dessous, avec sa raison. Rien n’a été appliqué.`,
  'translation.status.nothingAsked': `Rien n’a été demandé${NB}: aucun mot qui manque en {language} ne peut être demandé à un modèle, comme dit ci-dessous.`,
  'translation.status.stopped': 'Arrêté. Rien n’a été appliqué.',
  'translation.status.unreachable': `Rien n’a été appliqué. Le modèle n’a pas pu être joint${NB}: {reason}`,
  'translation.status.unreachableNoReason': 'Rien n’a été appliqué. Le modèle n’a pas pu être joint.',
  'translation.status.busy': `Rien n’a été appliqué. Le modèle répond à une autre demande${NB}: terminez-la ou arrêtez-la d’abord.`,
  'translation.status.declined': `Rien n’a été appliqué. Le modèle a refusé, en disant pourquoi${NB}: {reason}`,
  'translation.status.gaveUp': `Rien n’a été appliqué. Tentatives${NB}: {count}, et la réponse n’était toujours pas une traduction en {language}.`,
  'translation.status.tooLarge': `Rien n’a été demandé. La demande ferait {bytes} octets, au-delà des {max} qu’une demande peut avoir${NB}: écrivez d’abord une partie des mots.`,

  'translation.refused': `Refusé, «${NB}{text}${NB}» pour «${NB}{source}${NB}»${NB}: {reason}`,
  'translation.dropped.notAsked': `Non écrits, parce que personne ne les a demandés${NB}: {list}`,
  'translation.dropped.writtenMeanwhile': `Non écrits, parce qu’une personne les a écrits depuis${NB}: {list}`,
  'translation.dropped.gone': `Non écrits, parce que le rapport ne les imprime plus${NB}: {list}`,
  'translation.dropped.printsNoWords': `Non écrits, parce que l’expression n’imprime plus de mots${NB}: {list}`,
  'translation.dropped.noRoom': `Non écrits, parce que la langue {language} n’a plus de place pour eux${NB}: {list}`,
  'translation.forPerson': `À écrire par une personne, puisqu’ils figurent dans la section paiement${NB}: {list}`,
  'translation.later': `Laissés pour une autre demande, une fois ceux-ci appliqués, mots${NB}: {count}`,
  'translation.unasked': `Non demandés cette fois, mots${NB}: {count}`,
  'translation.noRoom.word': `La langue {language} contient autant de mots qu’une langue le peut, {max}${NB}: aucun autre n’est demandé avant que certains soient retirés.`,
  'translation.noRoom.expression': `La langue {language} contient autant d’expressions qu’une langue le peut, {max}${NB}: aucune autre n’est demandée avant que certaines soient retirées.`,
  'translation.leftEmpty': `Laissés non traduits par le modèle, mots${NB}: {count}`,

  'translation.noModel': 'Aucun modèle n’a été donné à cet éditeur pour l’interroger.',
  'translation.ownLanguage': `Les mots propres du rapport s’écrivent là où ils figurent${NB}: choisissez une autre de ses langues pour demander ses mots à un modèle.`,
  'translation.lacksNothing': 'Il ne manque aucun mot en {language}.',
  'translation.waiting': `Un modèle traduit encore en {language}${NB}: arrêtez-le, ou attendez sa réponse.`,
  'translation.held': `La traduction en {language} d’un modèle attend d’être examinée${NB}: appliquez-la ou abandonnez-la d’abord.`,
  'translation.notWaiting': 'Aucun modèle n’est interrogé.',
  'translation.nothingHeld': 'Aucune traduction d’un modèle n’est tenue ici.',
  'translation.nothingAccepted': `Rien n’est encore accepté${NB}: acceptez un mot pour l’appliquer.`,
  'translation.applied': `Traduit en {language}, mots${NB}: {count}. Mots encore manquants${NB}: {missing}.`,
  'translation.appliedAll': `Traduit en {language}, mots${NB}: {count}. Il n’y manque plus aucun mot.`,
  'translation.discarded': 'Traduction en {language} d’un modèle abandonnée. Rien n’a été appliqué.',
  'translation.forgotten': 'La demande a été abandonnée avant la réponse du modèle, et rien de ce qu’il répond n’est tenu.',
  'translation.forgottenRemoved': 'La langue {language} a été retirée avant la réponse du modèle, et rien de ce qu’il répond n’est tenu.',
}
