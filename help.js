/* help.js — toute la documentation : bulles courtes, méthode détaillée, glossaire.
   Fichier séparé pour être relu et corrigé sans toucher au code. */
(function(root){
"use strict";

/* ---- bulles courtes, déclenchées par le « ? » à côté d'une métrique ---- */
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
  abri:{t:"Abri",
    d:"Le coefficient qui dit quelle fraction de la houle du large arrive devant la plage. Un spot en plein vent d'ouest sur la presqu'île de Crozon reçoit tout, voire un peu plus par concentration sur la pointe : son abri dépasse 1. Un spot au fond du goulet de Brest ou de la baie de Douarnenez n'en reçoit qu'un quart. C'est ce qui explique qu'un jour de tempête, les spots exposés ferment pendant que les abris se réveillent."},
  composantes:{t:"Les trois barres",
    d:"La note est la somme pondérée de trois qualités, affichées pour voir d'où elle vient. Taille : la vague est-elle dans le créneau utile du spot. Propreté : vent, rafales, mémoire et mer croisée. Marée : est-on dans la fenêtre du spot. Deux sessions notées 3★ peuvent être très différentes — les barres le montrent."},
  fiabilite:{t:"Fiabilité",
    d:"Les trois premiers jours sont fiables. De J+4 à J+6 c'est une tendance, à reconfirmer 48 h avant. Au-delà, c'est purement indicatif : les jours lointains sont affichés en pâle et marqués d'un tilde pour qu'on ne pose pas un congé dessus."},
  carnet:{t:"Le carnet de session",
    d:"Après une session, tu notes ce que tu as vraiment trouvé. La page enregistre l'écart entre l'annoncé et le réel, avec les conditions du moment. Au bout d'une saison, ces écarts permettent de corriger les réglages de chaque spot — c'est ce qui transforme une interface sur une API publique en un outil calibré sur tes spots et ton jugement."},
  creneau:{t:"Créneau",
    d:"La plage horaire continue pendant laquelle le spot tient au moins une étoile. On planifie une matinée, pas un instant : un spot noté 3★ sur quatre heures vaut mieux qu'un 3★½ qui ne tient que quarante minutes avant que le vent tourne."}
};

/* ---- glossaire : les mots du forecast ---- */
var GLOSSARY=[
 ["Houle","Train de vagues formé au large par un vent lointain, qui voyage ensuite seul. Ordonnée, régulière, elle arrive en séries. C'est elle qui fait les vagues surfables."],
 ["Mer du vent","Vagues formées sur place par le vent local. Courtes, désordonnées, sans puissance. Un chiffre de hauteur correct avec une période sous 8 s, c'est de la mer du vent, pas une session."],
 ["Période","Secondes entre deux crêtes. Le meilleur indicateur unique de la qualité d'une houle."],
 ["Hauteur significative","Ce que donnent les modèles : la moyenne du tiers des vagues les plus hautes, mesurée au large. Toujours inférieure à ce que tu vois déferler."],
 ["Hauteur de face","La hauteur du mur de la vague au moment où elle déferle. C'est celle qui t'intéresse, et c'est ce que la page affiche en premier."],
 ["Levée (shoaling)","Quand la houle arrive sur des fonds qui remontent, elle ralentit et grandit. Une houle longue lève beaucoup plus qu'une houle courte."],
 ["Réfraction","La houle pivote en approchant du rivage, guidée par les fonds. C'est pour ça qu'une houle longue rentre dans des spots théoriquement hors fenêtre."],
 ["Incidence","L'angle entre la direction de la houle et l'orientation de la plage. De face, toute l'énergie arrive. De biais, une partie glisse le long de la côte."],
 ["Offshore","Vent de terre vers mer. Il retient la lèvre, creuse la vague et lisse la surface. Le meilleur cas."],
 ["Onshore","Vent de mer vers terre. Il pousse la vague à déferler trop tôt et hache la surface. Le pire cas."],
 ["Cross-shore","Vent parallèle à la plage. Entre les deux : ça ne détruit pas, ça salit."],
 ["Glassy","Surface parfaitement lisse, sans vent. Rare et recherché."],
 ["Marnage","Différence de hauteur entre la pleine et la basse mer du jour. En Bretagne, 3 à 8 m selon le coefficient."],
 ["Coefficient de marée","Nombre de 20 à 120 qui mesure l'ampleur de la marée du jour. Échelle française, référencée à Brest. Au-delà de 95, gros courants."],
 ["Étale","Le moment où la mer ne monte ni ne descend, autour de la pleine et de la basse mer."],
 ["Beach break","Vague qui déferle sur du sable. Bancs mobiles, change après chaque tempête."],
 ["Reef","Vague qui déferle sur du rocher. Constante, souvent plus creuse, moins pardonnante."],
 ["Shorebreak","Vague qui déferle directement sur le bord, souvent violemment. Redoutée en surf, recherchée en bodyboard."],
 ["Slab","Vague très épaisse et creuse sur un fond qui remonte brutalement. Engagé."],
 ["Baïne","Cuvette entre deux bancs de sable qui se vide vers le large en créant un courant puissant. Le vrai danger de la baie d'Audierne."],
 ["Mer croisée","Deux trains de houle d'angles et de périodes différents qui se superposent. Pics désordonnés."],
 ["Série","Groupe de vagues plus grosses que la moyenne. Plus la période est longue, plus les séries dépassent l'annonce."]
];

/* ---- méthode : le détail du fonctionnement ---- */
var METHOD=[
 {h:"Le problème que ça résout",
  p:["Les sites de prévision donnent des chiffres bruts : 1,8 m, 13 s, 290°, vent 15 nœuds de nord-est. Aucun ne dit ce que ça donne à La Palue un mardi à marée montante. Ce lien-là, entre les chiffres et un spot précis, c'est de la connaissance locale, et c'est exactement ce qu'on a formalisé ici.",
     "Chaque spot a une fiche technique. La page croise ces réglages avec les prévisions, heure par heure, sur dix jours, et répond à une question unique : où et quand. Elle répond aussi « nulle part » quand c'est le cas — une réponse honnête « non » vaut autant qu'un oui."]},

 {h:"Les données",
  p:["Tout vient d'Open-Meteo, qui agrège les modèles de plus de quinze services météo nationaux, dont Météo-France et l'ECMWF. Deux appels sont faits par groupe de spots : un pour la mer (houles principale, secondaire et tertiaire, niveau de la mer, température de l'eau) et un pour l'atmosphère (vent, rafales, température, pluie, lever et coucher du soleil). Les prévisions de vagues sont recalculées toutes les six heures.",
     "Les appels partent de ton téléphone, pas d'un serveur : rien à héberger, rien à payer, et la page fonctionne même si personne ne s'en occupe. La dernière réponse est gardée en mémoire, donc sans réseau sur un parking tu vois quand même les dernières prévisions connues.",
     "Le calcul tourne dans un fil séparé du navigateur, pour que l'interface reste réactive pendant que les milliers de combinaisons spot × heure sont évaluées."]},

 {h:"Étape 1 — de la houle du large à la vague du spot",
  p:["Les modèles donnent la houle au large. Trois transformations la ramènent à ce que tu verras déferler.",
     "<b>L'abri.</b> Chaque spot a un coefficient qui dit quelle fraction de la houle lui parvient. Un spot de la presqu'île de Crozon dépasse 1, parce que la pointe concentre l'énergie. Un spot au fond du goulet de Brest tombe à 0,25. C'est ce qui explique qu'un jour de tempête, les spots exposés ferment pendant que les abris se réveillent.",
     "<b>L'incidence.</b> Une houle qui arrive de biais perd de l'énergie. Le facteur appliqué est la racine quatrième du cosinus de l'angle, avec un plancher pour tenir compte de la réfraction — la houle pivote en approchant du rivage et rentre un peu même de travers.",
     "<b>La levée.</b> Sur des fonds qui remontent, la houle ralentit et grandit, d'autant plus que sa période est longue. Une houle d'1 m à 15 s lève près de deux fois plus qu'à 7 s. Le résultat est converti en hauteur de face, celle du mur au moment où il déferle."]},

 {h:"Étape 2 — les quatre filtres éliminatoires",
  p:["Avant toute note, quatre questions binaires. Si l'une échoue, le spot est écarté et la page dit pourquoi.",
     "<b>La houle est-elle dans la fenêtre ?</b> C'est le filtre le plus discriminant et le plus souvent oublié. Une grosse houle d'ouest laisse Le Dossen parfaitement plat, parce qu'il regarde au nord. Hors fenêtre, rien d'autre ne compte.",
     "<b>Y a-t-il assez de taille ?</b> Sous le seuil du spot, il n'y a rien à lever.",
     "<b>La période est-elle suffisante ?</b> Sous le seuil, c'est de la mer du vent : court, désordonné, sans puissance, même si la hauteur paraît correcte.",
     "<b>Le vent est-il tenable ?</b> Un onshore au-delà de 15 nœuds, ou des rafales au-delà de 40, et c'est non."]},

 {h:"Étape 3 — les trois qualités",
  p:["Les spots qui passent sont notés sur trois axes, chacun entre 0 et 100 %.",
     "<b>Taille (55 %).</b> Le facteur dominant : sans vague, rien d'autre ne compte. La note est maximale dans la bande utile du spot, avec une préférence marquée autour de l'optimum, et redescend progressivement de part et d'autre. Une houle longue reçoit un léger bonus de puissance.",
     "<b>Propreté (25 %).</b> Combine quatre choses : l'axe du vent par rapport au spot, sa force — l'offshore tolère beaucoup plus que l'onshore —, l'écart aux rafales, et la mer croisée. S'y ajoute la mémoire du vent : la qualité des heures précédentes pèse pour un tiers, parce que la mer met du temps à se ranger.",
     "<b>Marée (20 %).</b> Position dans la fenêtre du spot, avec une dégradation continue à mesure qu'on s'en éloigne. Les spots qui ne marchent qu'en montante sont pénalisés si la marée descend.",
     "La propreté joue en plus comme multiplicateur global : une belle houle dans un vent dedans ne fait pas une bonne session, quelle que soit la taille. Enfin la taille commande le total — c'est ce qui évite qu'un spot passe de rien à une bonne note pour trois centimètres."]},

 {h:"Étape 4 — le réglage bodyboard",
  p:["Le barème n'est pas neutre : il est réglé pour le bodyboard. Les vagues creuses, les shorebreaks et les bancs qui ferment sont des atouts, pas des défauts. Onze spots sont marqués comme shorebreak ou reef creux, et reçoivent un bonus quand la marée les place dans leur fenêtre sur une houle longue.",
     "Un longboarder voudrait l'inverse : des vagues molles et épaulées, et le classement serait différent."]},

 {h:"Pourquoi tout est progressif",
  p:["Un spot ne s'allume pas d'un coup à 0,80 m pour rester mort à 0,79 m. Toutes les transitions sont lissées par des rampes en cosinus : la note monte et descend continûment.",
     "Ça évite la carte qui clignote d'une heure à l'autre pour trois centimètres, et ça reflète mieux la réalité — une taille limite donne une session limite, pas un tout ou rien."]},

 {h:"Ce que l'outil ne sait pas",
  p:["<b>L'état des bancs de sable.</b> Ils changent après chaque coup de vent, et aucun modèle ne les suit. Deux beach breaks voisins peuvent être radicalement différents la même semaine.",
     "<b>La fréquentation.</b> Aucune donnée.",
     "<b>Les fermetures, interdictions et pollutions.</b> Aucune donnée non plus.",
     "<b>Les courants.</b> Ils ne sont pas modélisés. Sur les gros coefficients, dans les baïnes de la baie d'Audierne, à Pen Hat ou sur la Côte Sauvage, le courant est souvent le vrai danger, bien avant la taille des vagues. Une note de 4★ dit que les vagues seront bonnes, pas que le spot est sûr.",
     "<b>Et surtout : les réglages des spots sont des estimations de départ.</b> Certains sont sûrement faux. C'est exactement ce que le carnet de session sert à corriger."]},

 {h:"Comment l'outil s'améliore",
  p:["Après une session, tu notes ce que tu as vraiment trouvé, sur la même échelle de quatre étoiles. La page enregistre l'écart entre l'annoncé et le réel, avec toutes les conditions du moment : taille, période, vent, marée, coefficient.",
     "Ces écarts, accumulés sur une saison, disent quels spots sont mal réglés et dans quel sens. Un spot systématiquement surestimé a probablement un abri trop élevé ou un seuil trop bas. C'est ce qui fait passer l'outil d'une interface sur une API publique à quelque chose de calibré sur tes spots et ton jugement."]},

 {h:"Lire la carte",
  p:["Chaque pastille est un spot, colorée par la note de l'heure affichée. La taille et la forme portent la même information que la couleur, pour rester lisible sans distinguer le rouge du vert : cercle vide, rien à en tirer ; cercle barré, des vagues mais inexploitables ; à partir de trois étoiles un anneau clair apparaît au centre, rejoint par un point à quatre.",
     "Un contour pointillé jaune marque les favoris. La carte se zoome au pincement ou à la molette et se déplace au doigt — utile pour séparer Port Blanc, Port Bara et Port Rhu, qui tiennent dans un kilomètre."]},

 {h:"Lire la frise",
  p:["L'aire bleue est la hauteur de houle au large, la ligne pointillée la période, les barres colorées la note du meilleur spot à chaque heure. Les plages grisées sont la nuit.",
     "C'est là qu'on voit si le créneau est le matin ou le soir, et à quel moment le vent se lève."]}
];

root.HELP={TIPS:TIPS,GLOSSARY:GLOSSARY,METHOD:METHOD,GUIDE:METHOD};
if(typeof module!=="undefined"&&module.exports)module.exports=root.HELP;
})(typeof self!=="undefined"?self:this);
