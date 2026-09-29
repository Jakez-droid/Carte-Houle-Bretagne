/* help.js — textes d'aide : bulles sur les métriques et page « Comment ça marche ».
   Séparé du reste pour être relu et corrigé sans toucher au code. */
(function(root){
"use strict";

// Bulles courtes, déclenchées par le petit « ? » à côté d'une métrique.
var TIPS={
  etoiles:{t:"La note sur 4 étoiles",
    d:"Une seule note qui résume trois choses : la taille, la propreté et la marée. 1★ c'est surfable sans plus, 2★ correct, 3★ ça vaut le déplacement, 4★ session à ne pas rater. En dessous d'une étoile, la page le dit franchement plutôt que d'afficher une demi-étoile trompeuse."},
  face:{t:"Taille de face",
    d:"La hauteur de la vague au déferlement, pas celle de la houle au large. Elle se calcule en trois temps : on réduit la houle du large selon l'abri du spot et l'angle sous lequel elle arrive, puis on applique le gain de levée dû à la période, puis on convertit en hauteur de face. Une houle d'1 m à 14 s donne une vague bien plus grosse que la même hauteur à 7 s. C'est un ordre de grandeur, pas une mesure."},
  houle:{t:"Houle au spot",
    d:"Ce qui reste de la houle du large une fois arrivée devant la plage. Deux effets la réduisent : l'abri (un spot au fond d'une baie reçoit une fraction de ce qui passe au large) et l'incidence (une houle qui arrive de biais perd de l'énergie). C'est cette valeur qui se compare aux seuils du spot."},
  periode:{t:"Période",
    d:"Le temps entre deux crêtes, en secondes. C'est le critère qui sépare une vraie houle d'un clapot. En dessous de 8 s c'est de la mer du vent : court, désordonné, sans puissance. Entre 10 et 13 s la houle est formée. Au-delà de 14 s elle vient de loin, elle lève beaucoup au bord et les séries dépassent nettement la moyenne annoncée."},
  vent:{t:"Vent et direction",
    d:"L'offshore souffle de la terre vers la mer et tient la lèvre : c'est le meilleur cas, et il tolère de la force. L'onshore souffle dans le dos de la vague et hache la surface : même faible il dégrade, au-delà de 15 nœuds il ruine la session. Le cross est entre les deux. La direction est calculée par rapport à l'orientation du spot, pas dans l'absolu — un vent de nord-est est offshore à La Torche et onshore au Dossen."},
  rafales:{t:"Rafales",
    d:"Un vent moyen honnête avec de grosses rafales reste injouable : la surface travaille par à-coups. Quand l'écart entre le vent moyen et les rafales dépasse une dizaine de nœuds, la note baisse même si la moyenne paraît correcte."},
  memoire:{t:"Mémoire du vent",
    d:"La mer garde la trace du vent des heures précédentes. Un spot annoncé offshore à 8h après une nuit entière d'onshore ne sera pas encore rangé. La note tient compte des heures d'avant, avec un poids décroissant — c'est ce qui évite de descendre sur une promesse."},
  maree:{t:"Marée et coefficient",
    d:"En Bretagne le marnage atteint 6 à 8 m : la marée n'est pas un détail, elle ouvre et ferme les spots. Chaque spot a sa fenêtre — certains ne marchent qu'à marée montante, d'autres qu'à basse. Le coefficient, de 20 à 120, mesure l'ampleur de la marée du jour : c'est un nombre unique référencé à Brest. Au-dessus de 95, le courant devient un vrai facteur et la fenêtre défile vite."},
  croisee:{t:"Mer croisée",
    d:"Quand deux trains de houle arrivent sous des angles et avec des périodes différents, ils se contrarient : pics désordonnés, séries qui s'annulent, vagues qui ferment sans prévenir. La page compare la houle principale aux houles secondaire et tertiaire et retire des points quand elles se croisent vraiment."},
  fenetre:{t:"Fenêtre de houle",
    d:"L'arc de directions depuis lesquelles une houle atteint réellement le spot. C'est le filtre le plus discriminant et le plus souvent oublié : une grosse houle d'ouest qui allume la côte sauvage laisse Le Dossen parfaitement plat, parce qu'il regarde au nord. Hors fenêtre, aucun autre paramètre ne compte."},
  composantes:{t:"Les trois barres",
    d:"La note est la somme pondérée de trois qualités, affichées pour voir d'où elle vient. Taille : la vague est-elle dans le créneau utile du spot. Propreté : vent, rafales, mémoire et mer croisée. Marée : est-on dans la fenêtre du spot. Deux sessions notées 3★ peuvent être très différentes — les barres le montrent."},
  fiabilite:{t:"Fiabilité",
    d:"Les trois premiers jours sont fiables. De J+4 à J+6 c'est une tendance, à reconfirmer 48 h avant. Au-delà, c'est purement indicatif : les jours lointains sont affichés en pâle et marqués d'un tilde pour qu'on ne pose pas un congé dessus."},
  carnet:{t:"Le carnet de session",
    d:"Après une session, tu notes ce que tu as vraiment trouvé. La page enregistre l'écart entre l'annoncé et le réel, avec les conditions du moment. Au bout d'une saison, ces écarts permettent de corriger les réglages de chaque spot — c'est ce qui transforme une interface sur une API publique en un outil calibré sur tes spots et ton jugement."}
};

var GUIDE=[
  {h:"Ce que fait cette page",
   p:["Les sites de prévision donnent des chiffres bruts : 1,8 m, 13 s, 290°, vent 15 nœuds de nord-est. Aucun ne dit ce que ça donne à La Palue un mardi à marée montante. Ce lien-là, entre les chiffres et un spot précis, c'est de la connaissance locale.",
      "Cette page le formalise. Chaque spot a une fiche technique — orientation, fenêtre de houle, abri, période minimale, fenêtre de marée, taille utile — et la page croise ces réglages avec les prévisions, heure par heure, sur dix jours. Elle répond à une question : où et quand.",
      "Elle répond aussi « nulle part » quand c'est le cas. Une réponse honnête « non » vaut autant qu'un oui."]},
  {h:"D'où viennent les données",
   p:["Open-Meteo, qui agrège les modèles de plus de quinze services météo nationaux, dont Météo-France et l'ECMWF. Les prévisions de vagues sont mises à jour toutes les six heures.",
      "Les appels partent de ton téléphone, pas d'un serveur. Il n'y a rien à héberger, rien à payer, et la page fonctionne même si personne ne s'en occupe. La dernière réponse est gardée en mémoire : sans réseau, sur un parking, tu vois quand même les dernières prévisions connues."]},
  {h:"Comment la note est calculée",
   p:["Quatre filtres éliminatoires d'abord. La houle est-elle dans la fenêtre du spot, sinon c'est plat. Y a-t-il assez de taille. La période dépasse-t-elle le seuil du spot, sinon c'est de la mer du vent. Le vent onshore est-il tenable.",
      "Puis trois qualités, notées de 0 à 100 % et pondérées. La taille compte pour 55 % : c'est le facteur dominant, sans vague rien d'autre ne compte. La propreté pour 25 % : vent, rafales, mémoire des heures précédentes, mer croisée. La marée pour 20 %.",
      "La propreté joue en plus comme multiplicateur : une belle houle dans un vent dedans ne fait pas une bonne session, quelle que soit la taille. Enfin un bonus pour les shorebreaks quand la marée les place dans leur fenêtre sur une houle longue — parce que l'outil est réglé pour le bodyboard, où une vague creuse qui ferme est un atout."]},
  {h:"Pourquoi les seuils sont progressifs",
   p:["Un spot ne s'allume pas d'un coup à 0,80 m pour rester mort à 0,79 m. Toutes les transitions sont lissées : la note monte et descend continûment. Ça évite la carte qui clignote d'une heure à l'autre pour trois centimètres, et ça reflète mieux la réalité, où une taille limite donne une session limite."]},
  {h:"Lire la carte",
   p:["Chaque pastille est un spot, colorée par la note de l'heure affichée. La taille et la forme portent la même information que la couleur, pour rester lisible sans distinguer le rouge du vert : un cercle vide signifie qu'il n'y a rien à en tirer, un cercle barré que les vagues sont là mais inexploitables, et à partir de trois étoiles un anneau clair apparaît au centre, rejoint par un point à quatre.",
      "Un contour pointillé jaune marque tes favoris. La carte se zoome au pincement ou à la molette et se déplace au doigt — utile pour séparer Port Blanc, Port Bara et Port Rhu, qui tiennent dans un kilomètre."]},
  {h:"Lire la frise et le semainier",
   p:["Le semainier donne la meilleure note de chaque journée : un coup d'œil suffit pour repérer le bon jour de la semaine. Les jours lointains sont estompés selon leur fiabilité.",
      "En dessous, la frise montre la journée choisie heure par heure. L'aire bleue est la hauteur de houle au large, la ligne pointillée la période, et les barres colorées la note du meilleur spot à chaque heure. C'est là qu'on voit si le créneau est le matin ou le soir, et à quel moment le vent se lève."]},
  {h:"Ce que l'outil ne sait pas",
   p:["L'état des bancs de sable, qui change après chaque coup de vent. La fréquentation. Les fermetures temporaires et les interdictions locales. La qualité de l'eau après de fortes pluies.",
      "Et surtout : les réglages de chaque spot sont des estimations de départ. Certains sont sûrement faux. C'est exactement ce que le carnet de session sert à corriger — note ce que tu trouves vraiment, et les écarts finiront par recaler les fiches."]},
  {h:"Sécurité",
   p:["Les courants forts ne sont pas modélisés. Sur les gros coefficients, dans les baïnes de la baie d'Audierne, à Pen Hat ou sur la Côte Sauvage, le courant est souvent le vrai danger, bien avant la taille des vagues.",
      "Une note de 4★ ne veut pas dire que le spot est sûr. Elle veut dire que les vagues y seront bonnes."]}
];

root.HELP={TIPS:TIPS,GUIDE:GUIDE};
if(typeof module!=="undefined"&&module.exports)module.exports=root.HELP;
})(typeof self!=="undefined"?self:this);
