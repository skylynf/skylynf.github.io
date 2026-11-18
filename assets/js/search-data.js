// get the ninja-keys element
const ninja = document.querySelector('ninja-keys');

// add the home and posts menu items
ninja.data = [{
    id: "nav-about",
    title: "about",
    section: "Navigation",
    handler: () => {
      window.location.href = "/";
    },
  },{id: "nav-publications",
          title: "publications",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/publications/";
          },
        },{id: "nav-academic-service",
          title: "academic service",
          description: "Academic service and peer-review contributions.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/service/";
          },
        },{id: "nav-cv",
          title: "cv",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/cv/";
          },
        },{id: "news-our-paper-biteeeg-was-accepted-by-bibm-2025",
          title: 'Our paper BiteEEG was accepted by BIBM 2025.',
          description: "",
          section: "News",},{id: "news-i-am-serving-on-the-program-committee-for-aaai-2026",
          title: 'I am serving on the Program Committee for AAAI 2026.',
          description: "",
          section: "News",},{id: "news-our-paper-was-accepted-by-briefings-in-bioinformatics",
          title: 'Our paper was accepted by Briefings in Bioinformatics.',
          description: "",
          section: "News",},{id: "news-our-paper-gaussmedact-was-accepted-by-aaai-2026-sparkles",
          title: 'Our paper GaussMedAct was accepted by AAAI 2026. :sparkles:',
          description: "",
          section: "News",},{id: "news-i-received-the-dr-burn-lin-travel-grant-award-from-the-osu-ece-department",
          title: 'I received the Dr. Burn Lin Travel Grant Award from the OSU ECE...',
          description: "",
          section: "News",},{id: "news-our-paper-on-the-host-mediated-global-spread-of-h7-influenza-a-virus-was-published-in-nature-communications",
          title: 'Our paper on the host-mediated global spread of H7 influenza A virus was...',
          description: "",
          section: "News",},{id: "news-our-paper-on-evaluating-a-scaffolding-oriented-multi-agent-llm-system-for-clinical-interview-training-was-accepted-by-npj-digital-medicine",
          title: 'Our paper on evaluating a scaffolding-oriented multi-agent LLM system for clinical interview training...',
          description: "",
          section: "News",},{id: "news-i-am-serving-on-the-program-committee-for-ieee-bibm-2026",
          title: 'I am serving on the Program Committee for IEEE BIBM 2026.',
          description: "",
          section: "News",},{id: "news-i-was-nominated-by-the-department-of-electrical-and-computer-engineering-at-the-ohio-state-university-for-the-presidential-fellowship",
          title: 'I was nominated by the Department of Electrical and Computer Engineering at The...',
          description: "",
          section: "News",},{id: "news-i-passed-my-phd-candidacy-exam-i-am-grateful-to-my-advisor-prof-alper-yilmaz-and-committee-members-prof-rongjun-qin-prof-charles-toth-and-prof-jia-kevin-liu",
          title: 'I passed my PhD candidacy exam. I am grateful to my advisor, Prof....',
          description: "",
          section: "News",},{id: "news-i-am-serving-on-the-program-committee-for-the-41st-annual-aaai-conference-on-artificial-intelligence-aaai-27-to-be-held-in-montréal-canada-february-16-23-2027",
          title: 'I am serving on the Program Committee for the 41st Annual AAAI Conference...',
          description: "",
          section: "News",},{id: "news-i-am-serving-on-the-program-committee-for-the-2027-ieee-international-symposium-on-biomedical-imaging-isbi-2027-to-be-held-in-lausanne-switzerland-may-25-28-2027",
          title: 'I am serving on the Program Committee for the 2027 IEEE International Symposium...',
          description: "",
          section: "News",},{id: "news-i-am-serving-as-a-reviewer-for-frontiers-in-digital-health",
          title: 'I am serving as a reviewer for Frontiers in Digital Health.',
          description: "",
          section: "News",},{
        id: 'social-email',
        title: 'email',
        section: 'Socials',
        handler: () => {
          window.open("mailto:%79%61%6E%67.%37%36%37%30@%6F%73%75.%65%64%75", "_blank");
        },
      },{
        id: 'social-github',
        title: 'GitHub',
        section: 'Socials',
        handler: () => {
          window.open("https://github.com/skylynf", "_blank");
        },
      },{
        id: 'social-orcid',
        title: 'ORCID',
        section: 'Socials',
        handler: () => {
          window.open("https://orcid.org/0009-0002-5277-3278", "_blank");
        },
      },{
        id: 'social-rss',
        title: 'RSS Feed',
        section: 'Socials',
        handler: () => {
          window.open("/feed.xml", "_blank");
        },
      },{
        id: 'social-semanticscholar',
        title: 'Semantic Scholar',
        section: 'Socials',
        handler: () => {
          window.open("https://www.semanticscholar.org/author/2295689228", "_blank");
        },
      },{
      id: 'light-theme',
      title: 'Change theme to light',
      description: 'Change the theme of the site to Light',
      section: 'Theme',
      handler: () => {
        setThemeSetting("light");
      },
    },
    {
      id: 'dark-theme',
      title: 'Change theme to dark',
      description: 'Change the theme of the site to Dark',
      section: 'Theme',
      handler: () => {
        setThemeSetting("dark");
      },
    },
    {
      id: 'system-theme',
      title: 'Use system default theme',
      description: 'Change the theme of the site to System Default',
      section: 'Theme',
      handler: () => {
        setThemeSetting("system");
      },
    },];
