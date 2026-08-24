/**
 * Hindi clinical text for the seeded question bank.
 *
 * Entered here rather than machine-translated at runtime, because a mistranslated symptom
 * question produces a wrong answer, and a wrong answer produces a wrong assessment. Publication
 * refuses a locale whose clinical text is not marked clinician-approved.
 *
 * TODO(confirm): this translation needs review and approval by a Hindi-speaking clinician before
 * `hi` is added to a published version's approved locales.
 */
export const CLINICAL_TEXT_HI: Record<string, string> = {
  'entry.pain': 'पेट में दर्द या तकलीफ़',
  'entry.bowel': 'शौच की आदत में बदलाव',
  'entry.bleeding': 'शौच के समय खून आना',
  'entry.reflux': 'सीने में जलन, बदहज़मी, या निगलने में दिक्कत',
  'entry.liver': 'आँखों या त्वचा का पीला होना, या पेट में सूजन',

  'group.pain': 'दर्द',
  'group.bowel': 'शौच की आदत',
  'group.bleeding': 'रक्तस्राव',
  'group.reflux': 'एसिडिटी और निगलना',
  'group.liver': 'यकृत से संबंधित',
  'group.weight': 'वज़न और भूख',
  'group.systemic': 'आपकी समग्र स्थिति',
  'group.history': 'आपका चिकित्सा इतिहास',
  'group.meds': 'दवाइयाँ और जीवनशैली',

  'q.pain_present.prompt': 'क्या आपके पेट में कहीं दर्द या तकलीफ़ है?',
  'q.pain_site.prompt': 'यह कहाँ महसूस होता है? हर उस जगह पर टैप करें जो लागू हो।',
  'q.pain_site.help':
    'चित्र पर वहाँ टैप करें जहाँ दर्द महसूस होता है। अगर दर्द जगह बदलता है, तो हर जगह टैप करें।',
  'q.pain_severity.prompt': 'सबसे ज़्यादा होने पर दर्द कितना तेज़ होता है?',
  'scale.pain.none': 'कोई दर्द नहीं',
  'scale.pain.worst': 'सबसे भयंकर दर्द जिसकी मैं कल्पना कर सकता/सकती हूँ',
  'q.pain_duration.prompt': 'यह दर्द कब से है?',
  'q.pain_pattern.prompt': 'दर्द का सबसे सही वर्णन क्या है?',
  'opt.pain_pattern.constant': 'यह हर समय बना रहता है',
  'opt.pain_pattern.comes_and_goes': 'यह आता-जाता रहता है',
  'opt.pain_pattern.worse_after_eating': 'खाने के बाद बढ़ जाता है',
  'opt.pain_pattern.better_after_eating': 'खाने के बाद कम हो जाता है',
  'opt.pain_pattern.wakes_me_at_night': 'रात में नींद से जगा देता है',
  'q.pain_radiates.prompt': 'क्या दर्द कहीं और भी फैलता है?',
  'opt.pain_radiates.to_back': 'पीठ तक',
  'opt.pain_radiates.to_shoulder': 'कंधे या कंधे की हड्डी तक',
  'opt.pain_radiates.to_groin': 'नीचे जांघ के जोड़ की ओर',
  'opt.pain_radiates.nowhere': 'यह एक ही जगह रहता है',
  'q.pain_relief_position.prompt': 'क्या किसी चीज़ से दर्द में फ़र्क पड़ता है?',
  'opt.pain_relief_position.leaning_forward': 'आगे की ओर झुककर बैठने से आराम मिलता है',
  'opt.pain_relief_position.lying_still': 'बिल्कुल स्थिर लेटने से आराम मिलता है',
  'opt.pain_relief_position.nothing_helps': 'किसी चीज़ से फ़र्क नहीं पड़ता',
  'q.abdomen_rigid.prompt': 'क्या आपका पेट छूने में सख़्त है, और दबाने पर बहुत दर्द होता है?',
  'q.abdomen_rigid.help':
    'उंगलियों से पेट को हल्के से दबाकर देखें। हम पूछ रहे हैं कि क्या यह नरम के बजाय अकड़ा हुआ या तख़्ते जैसा लगता है, और दबाने पर तेज़ दर्द होता है।',
  'q.abdomen_distended.prompt': 'क्या आपका पेट सामान्य से ज़्यादा फूला या सूजा हुआ है?',
  'q.vomiting.prompt': 'क्या आपको उल्टी हो रही है?',
  'q.vomit_appearance.prompt': 'उल्टी कैसी दिखती थी?',
  'opt.vomit_appearance.food_only': 'सिर्फ़ खाना और तरल',
  'opt.vomit_appearance.bile_green': 'हरी या पीली',
  'opt.vomit_appearance.blood_red': 'उसमें ताज़ा लाल खून था',
  'opt.vomit_appearance.coffee_grounds': 'गहरे भूरे रंग की, कॉफ़ी के दानों जैसी',
  'opt.vomit_appearance.faeculent': 'उसमें मल जैसी गंध या रूप था',
  'q.passing_wind_or_stool.prompt': 'क्या आप गैस निकाल पा रहे हैं या शौच जा पा रहे हैं?',
  'q.passing_wind_or_stool.help': 'पिछले पूरे एक दिन के बारे में सोचें।',
  'opt.passing_wind_or_stool.both_normally': 'हाँ, दोनों सामान्य रूप से',
  'opt.passing_wind_or_stool.wind_only': 'सिर्फ़ गैस, शौच नहीं',
  'opt.passing_wind_or_stool.neither_for_a_day': 'एक दिन या उससे ज़्यादा से कुछ भी नहीं',

  'q.bowel_change.prompt': 'क्या आपकी शौच की आदत आपके सामान्य से बदल गई है?',
  'q.bowel_change_direction.prompt': 'कैसे बदली है? जो भी लागू हो सब चुनें।',
  'opt.bowel_change_direction.looser': 'ज़्यादा पतला या पानी जैसा',
  'opt.bowel_change_direction.harder': 'ज़्यादा कड़ा या निकालने में मुश्किल',
  'opt.bowel_change_direction.more_often': 'पहले से ज़्यादा बार',
  'opt.bowel_change_direction.less_often': 'पहले से कम बार',
  'opt.bowel_change_direction.alternating': 'कभी पतला कभी कड़ा',
  'q.bowel_change_duration.prompt': 'यह कब से ऐसा है?',
  'q.bowel_change_duration.help':
    'दो हफ़्ते से ज़्यादा चलने वाला बदलाव, कारण चाहे जो हो, डॉक्टर को दिखाना ज़रूरी है।',
  'q.stool_form.prompt': 'अधिकतर समय आपका मल किस चित्र के सबसे नज़दीक होता है?',
  'q.stool_form.help':
    'यह चार्ट मल का वर्णन करने का एक मानक तरीक़ा है। सबसे नज़दीकी चुनें — बिल्कुल सही होना ज़रूरी नहीं।',
  'opt.stool_form.type_1': 'अलग-अलग कड़े टुकड़े, मेवे जैसे',
  'opt.stool_form.type_2': 'सॉसेज जैसा पर गाँठदार',
  'opt.stool_form.type_3': 'सॉसेज जैसा, सतह पर दरारें',
  'opt.stool_form.type_4': 'चिकना और नरम, सॉसेज या साँप जैसा',
  'opt.stool_form.type_5': 'नरम लोथड़े, किनारे साफ़',
  'opt.stool_form.type_6': 'फटे किनारों वाले भुरभुरे टुकड़े, लुगदी जैसा',
  'opt.stool_form.type_7': 'पूरी तरह तरल, कोई ठोस हिस्सा नहीं',
  'q.stool_frequency.prompt': 'आप दिन में कितनी बार शौच जाते हैं?',
  'q.night_time_stools.prompt': 'क्या आपको रात में शौच के लिए उठना पड़ता है?',
  'q.mucus_in_stool.prompt': 'क्या मल में लेस या जेली जैसा पदार्थ दिखा है?',
  'q.urgency_incontinence.prompt': 'क्या कभी शौचालय तक भागना पड़ता है, या कपड़े ख़राब हो जाते हैं?',
  'q.tenesmus.prompt': 'शौच के बाद भी क्या ऐसा लगता है कि पेट पूरी तरह साफ़ नहीं हुआ?',
  'term.tenesmus.lay': 'शौच के तुरंत बाद भी और जाने की ज़रूरत महसूस होना।',

  'q.blood_in_stool.prompt': 'क्या शौच के समय आपको खून दिखा है?',
  'q.blood_appearance.prompt': 'खून कैसा दिखता है?',
  'q.blood_appearance.help':
    'रंग से डॉक्टर को पता चलता है कि रक्तस्राव कहाँ से हो रहा है। चित्रों से मिलाकर सबसे नज़दीकी चुनें।',
  'term.melaena.lay':
    'बहुत गहरा, काला, चिपचिपा मल जिसमें अक्सर तेज़ गंध होती है। यह पाचन तंत्र के ऊपरी हिस्से से रक्तस्राव का संकेत हो सकता है।',
  'opt.blood_appearance.bright_red': 'चमकीला लाल',
  'opt.blood_appearance.dark_red': 'गहरा लाल या मरून',
  'opt.blood_appearance.black_tarry': 'काला, चिपचिपा, तारकोल जैसा',
  'q.blood_position.prompt': 'खून कहाँ है?',
  'opt.blood_position.mixed_in': 'पूरे मल में मिला हुआ',
  'opt.blood_position.coating_surface': 'मल के ऊपर परत जैसा',
  'opt.blood_position.on_paper_only': 'सिर्फ़ टॉयलेट पेपर पर',
  'opt.blood_position.in_the_pan_only': 'मल से अलग, शौचालय में टपकता हुआ',
  'q.blood_episodes.prompt': 'पिछले दो हफ़्तों में कितनी बार खून दिखा है?',
  'q.blood_duration.prompt': 'यह कब से हो रहा है?',
  'q.anal_symptoms.prompt': 'क्या गुदा के आसपास इनमें से कुछ है? जो लागू हो सब चुनें।',
  'opt.anal_symptoms.pain_on_passing': 'शौच के समय दर्द',
  'opt.anal_symptoms.itching': 'खुजली',
  'opt.anal_symptoms.lump': 'गाँठ या सूजन',
  'opt.anal_symptoms.none': 'इनमें से कोई नहीं',
  'q.vomited_blood.prompt': 'क्या आपको खून की उल्टी हुई है, या कॉफ़ी के दानों जैसी उल्टी?',

  'q.heartburn.prompt': 'क्या आपको सीने या ऊपरी पेट में जलन महसूस होती है?',
  'q.heartburn_frequency.prompt': 'यह कितनी बार होता है?',
  'opt.heartburn_frequency.less_than_weekly': 'हफ़्ते में एक बार से कम',
  'opt.heartburn_frequency.weekly': 'लगभग हफ़्ते में एक बार',
  'opt.heartburn_frequency.most_days': 'ज़्यादातर दिन',
  'opt.heartburn_frequency.daily': 'हर दिन',
  'q.heartburn_duration.prompt': 'यह कब से है?',
  'q.regurgitation.prompt': 'क्या खाना या खट्टा तरल वापस गले या मुँह में आ जाता है?',
  'q.swallowing_difficulty.prompt': 'क्या आपको निगलने में कोई दिक्कत होती है?',
  'term.dysphagia.lay': 'खाना या पानी नीचे जाने में धीमा लगना, अटकना, या मुश्किल होना।',
  'opt.swallowing_difficulty.solids_only': 'हाँ, सिर्फ़ ठोस खाने में',
  'opt.swallowing_difficulty.solids_and_liquids': 'हाँ, खाने और पीने दोनों में',
  'opt.swallowing_difficulty.food_sticks': 'खाना सचमुच अटक जाता है और वापस निकालना पड़ता है',
  'q.swallowing_worsening.prompt': 'क्या निगलने की दिक्कत बढ़ती जा रही है?',
  'q.early_satiety.prompt': 'क्या खाते समय पहले की तुलना में बहुत जल्दी पेट भर जाता है?',
  'q.early_satiety.help':
    'जैसे, कुछ ही कौर के बाद पेट भरा लगना जबकि पहले आप पूरा भोजन कर लेते थे।',

  'q.jaundice.prompt': 'क्या आपकी आँखों का सफ़ेद भाग या त्वचा पीली हो गई है?',
  'q.jaundice.help':
    'आमतौर पर आँखों का सफ़ेद भाग पहले रंग बदलता है, और दिन के उजाले में यह सबसे आसानी से दिखता है। चित्रों से मिलाकर देखें।',
  'q.urine_colour.prompt': 'आपके पेशाब का रंग कैसा है?',
  'opt.urine_colour.pale': 'बहुत हल्का, लगभग साफ़',
  'opt.urine_colour.normal_yellow': 'सामान्य पीला',
  'opt.urine_colour.dark_amber': 'गहरा कत्थई',
  'opt.urine_colour.tea_or_cola': 'बहुत गहरा, चाय या कोला जैसा',
  'q.stool_colour_pale.prompt': 'क्या आपका मल हल्के, मिट्टी या पुट्टी जैसे रंग का हो गया है?',
  'q.itching_skin.prompt': 'क्या बिना किसी दाने के पूरे शरीर में खुजली हुई है?',
  'q.abdominal_swelling.prompt': 'क्या पेट फूल गया है, जिससे कमर पर कपड़े कसने लगे हैं?',
  'term.ascites.lay': 'पेट के अंदर तरल जमा हो जाना, जिससे पेट फूल जाता है।',
  'q.leg_swelling.prompt': 'क्या आपके टख़नों या पैरों में सूजन आई है?',
  'q.confusion_drowsiness.prompt': 'क्या आप असामान्य रूप से भ्रमित, भुलक्कड़, या बहुत सुस्त रहे हैं?',
  'q.confusion_drowsiness.help':
    'अगर आपके किसी क़रीबी ने यह देखा है, भले ही आपने ख़ुद न देखा हो, तो कृपया हाँ चुनें।',
  'q.easy_bruising.prompt': 'क्या पहले की तुलना में आसानी से नील पड़ते हैं या खून बहता है?',

  'q.weight_loss.prompt': 'क्या बिना कोशिश किए आपका वज़न घटा है?',
  'q.weight_loss.help':
    'हमारा मतलब उस वज़न से है जो अपने आप कम हुआ — डाइटिंग, ज़्यादा व्यायाम, या खान-पान बदलने से नहीं।',
  'q.weight_loss_kg.prompt': 'लगभग कितना वज़न घटा है?',
  'q.weight_loss_period.prompt': 'कितने समय में घटा?',
  'q.appetite_change.prompt': 'क्या आपकी भूख में बदलाव आया है?',
  'opt.appetite_change.unchanged': 'कोई बदलाव नहीं',
  'opt.appetite_change.reduced': 'पहले से कम खा रहा/रही हूँ',
  'opt.appetite_change.increased': 'पहले से ज़्यादा खा रहा/रही हूँ',

  'q.lightheaded.prompt': 'क्या आपको चक्कर, सिर हल्का लगना, या असामान्य कमज़ोरी महसूस हुई है?',
  'q.fainted.prompt': 'क्या आप बेहोश हुए हैं या आँखों के आगे अंधेरा छाया है?',
  'q.fever.prompt': 'क्या आपको बुख़ार या ठंड लगकर गर्मी महसूस हुई है?',
  'q.night_sweats.prompt': 'क्या रात में पसीने से भीगकर नींद खुलती है?',
  'q.fatigue.prompt': 'क्या आप असामान्य रूप से थके रहते हैं?',
  'q.unable_to_keep_fluids_down.prompt':
    'क्या आप कुछ भी तरल, यहाँ तक कि पानी के घूँट भी, पेट में नहीं रोक पा रहे?',
  'q.passing_much_less_urine.prompt': 'क्या आप सामान्य से बहुत कम पेशाब कर रहे हैं?',

  'q.known_conditions.prompt': 'क्या आपको इनमें से कुछ बताया गया है? जो लागू हो सब चुनें।',
  'opt.known_conditions.ibd': 'आँत की सूजन वाली बीमारी',
  'opt.known_conditions.peptic_ulcer': 'पेट या आँत का अल्सर',
  'opt.known_conditions.gallstones': 'पित्ताशय की पथरी',
  'opt.known_conditions.liver_disease': 'यकृत की बीमारी',
  'opt.known_conditions.pancreatitis': 'अग्न्याशय की सूजन',
  'opt.known_conditions.diabetes': 'मधुमेह',
  'opt.known_conditions.none': 'इनमें से कोई नहीं',
  'q.previous_gi_surgery.prompt': 'क्या आपके पेट या आँत का कभी ऑपरेशन हुआ है?',
  'q.previous_endoscopy.prompt': 'क्या आपके पेट या आँत की कभी दूरबीन जाँच हुई है?',
  'q.family_gi_cancer.prompt':
    'क्या आपके किसी नज़दीकी रक्त-संबंधी को आँत, पेट, भोजन-नली, यकृत, या अग्न्याशय का कैंसर हुआ है?',
  'q.family_gi_cancer.help': 'नज़दीकी रक्त-संबंधी यानी माता-पिता, भाई-बहन, और संतान।',
  'q.family_ibd.prompt': 'क्या किसी नज़दीकी रक्त-संबंधी को आँत की सूजन वाली बीमारी बताई गई है?',
  'q.other_history.prompt': 'क्या आपकी सेहत के बारे में कुछ और है जो डॉक्टर को जानना चाहिए?',

  'q.painkiller_use.prompt':
    'आप जोड़ों के दर्द, सिरदर्द, या बुख़ार की दर्द-निवारक दवा कितनी बार लेते हैं?',
  'q.painkiller_use.help':
    'हमारा मतलब ख़ासकर सूजन कम करने वाली दर्द-निवारक दवाओं से है। अगर आपको प्रकार पता नहीं, तो जितना ठीक लगे उत्तर दें और बाद में दवा का नाम लिख दें।',
  'opt.painkiller_use.never': 'कभी नहीं',
  'opt.painkiller_use.occasionally': 'कभी-कभी',
  'opt.painkiller_use.most_weeks': 'ज़्यादातर हफ़्ते',
  'opt.painkiller_use.daily': 'हर दिन',
  'q.acid_medication_use.prompt': 'क्या आप एसिडिटी या जलन के लिए नियमित कुछ लेते हैं?',
  'q.blood_thinner_use.prompt': 'क्या आप खून पतला करने वाली कोई दवा लेते हैं?',
  'q.alcohol_use.prompt': 'आप कितनी बार शराब पीते हैं?',
  'opt.alcohol_use.never': 'कभी नहीं',
  'opt.alcohol_use.occasional': 'कभी-कभी',
  'opt.alcohol_use.weekly': 'लगभग हफ़्ते में एक बार',
  'opt.alcohol_use.most_days': 'ज़्यादातर दिन',
  'q.tobacco_use.prompt': 'क्या आप किसी भी रूप में तंबाकू का सेवन करते हैं?',
  'opt.tobacco_use.never': 'कभी नहीं',
  'opt.tobacco_use.former': 'पहले करता/करती था, अब नहीं',
  'opt.tobacco_use.current_smoking': 'हाँ, मैं धूम्रपान करता/करती हूँ',
  'opt.tobacco_use.current_chewing': 'हाँ, मैं तंबाकू, गुटखा, या पान मसाला खाता/खाती हूँ',
  'q.recent_travel_or_outside_food.prompt':
    'पिछले महीने में क्या आपने यात्रा की, या ऐसा खाना-पानी लिया जिस पर आपको संदेह था?',
  'q.current_medications.prompt': 'आप इस समय कौन-कौन सी दवाइयाँ ले रहे हैं?',
  'q.current_medications.help':
    'वह सब लिखें जो आप नियमित लेते हैं, और जो डॉक्टर ने हाल में शुरू की हो। पर्चा हो तो उसकी फ़ोटो भी अपलोड कर सकते हैं।',

  'redflag.upper_gi_bleed_with_hypovolaemia':
    'आपके उत्तर रक्तस्राव के साथ कमज़ोरी या चक्कर का वर्णन करते हैं। इस स्थिति में तुरंत आमने-सामने चिकित्सा ज़रूरी है — कृपया अभी नज़दीकी आपातकालीन विभाग जाएँ।',
  'redflag.possible_perforation':
    'आपके उत्तर तेज़ दर्द के साथ सख़्त पेट का वर्णन करते हैं। इस स्थिति में तुरंत आमने-सामने चिकित्सा ज़रूरी है — कृपया अभी नज़दीकी आपातकालीन विभाग जाएँ।',
  'redflag.possible_obstruction':
    'आपके उत्तर फूले पेट, उल्टी, और कुछ भी न निकलने का वर्णन करते हैं। इस स्थिति में तुरंत आमने-सामने चिकित्सा ज़रूरी है — कृपया अभी नज़दीकी आपातकालीन विभाग जाएँ।',
  'redflag.severe_dehydration':
    'आपके उत्तर बताते हैं कि आप जितना तरल ले पा रहे हैं उससे ज़्यादा खो रहे हैं। इसमें तुरंत आमने-सामने चिकित्सा ज़रूरी है — कृपया अभी नज़दीकी आपातकालीन विभाग जाएँ।',
  'redflag.hepatic_decompensation':
    'आपके उत्तर पीलेपन के साथ भ्रम या रक्तस्राव का वर्णन करते हैं। इस स्थिति में तुरंत आमने-सामने चिकित्सा ज़रूरी है — कृपया अभी नज़दीकी आपातकालीन विभाग जाएँ।',
  'redflag.biliary_sepsis':
    'आपके उत्तर पीलेपन के साथ बुख़ार और दाहिनी ओर दर्द का वर्णन करते हैं। इस स्थिति में तुरंत आमने-सामने चिकित्सा ज़रूरी है — कृपया अभी नज़दीकी आपातकालीन विभाग जाएँ।',
  'redflag.progressive_dysphagia':
    'आपके उत्तर बताते हैं कि निगलने में दिक्कत समय के साथ बढ़ रही है। इसके लिए जल्द किसी विशेषज्ञ से मिलना ज़रूरी है।',
  'redflag.bleeding_with_weight_loss_over_45':
    'उत्तरों का यह संयोजन जल्द किसी विशेषज्ञ की जाँच माँगता है।',
  'redflag.persistent_bowel_change_over_45':
    'इतने लंबे समय से चली आ रही शौच की आदत में बदलाव के लिए जल्द विशेषज्ञ की जाँच ज़रूरी है।',
  'redflag.substantial_unintentional_weight_loss':
    'बिना कोशिश के इतना वज़न घटने पर जल्द विशेषज्ञ की जाँच ज़रूरी है।',
  'redflag.frequent_mixed_bleeding': 'इस तरह बार-बार होने वाले रक्तस्राव की जल्द विशेषज्ञ जाँच ज़रूरी है।',
  'redflag.bloody_diarrhoea_with_fever':
    'बार-बार पतले दस्त के साथ खून और बुख़ार होने पर जल्द विशेषज्ञ की जाँच ज़रूरी है।',
  'redflag.new_jaundice': 'आँखों या त्वचा का पीला होना हमेशा जल्दी डॉक्टर को दिखाना चाहिए।',
  'redflag.prolonged_bleeding': 'यह इतने समय से चल रहा है कि डॉक्टर को इसकी समीक्षा करनी चाहिए।',
  'redflag.night_time_symptoms': 'रात में नींद तोड़ने वाले लक्षण समीक्षा करने वाले डॉक्टर को बताने योग्य हैं।',
  'redflag.longstanding_reflux': 'कई वर्षों से रोज़ाना होने वाले लक्षण समीक्षा करने वाले डॉक्टर को बताने योग्य हैं।',
  'redflag.family_history_with_symptoms':
    'इन लक्षणों के साथ आपका पारिवारिक इतिहास समीक्षा करने वाले डॉक्टर को बताने योग्य है।',
};

/** The shared yes / no / not-sure labels, applied to every question that uses them. */
export const COMMON_OPTION_TEXT_HI: Record<string, string> = {
  yes: 'हाँ',
  no: 'नहीं',
  unsure: 'पता नहीं',
};
