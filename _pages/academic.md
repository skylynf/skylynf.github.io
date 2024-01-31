---
layout: archive
title: "Academic Experience"
permalink: /academic/
author_profile: true
---

{% if author.googlescholar %}
  You can also find my articles on <u><a href="{{author.googlescholar}}">my Google Scholar profile</a>.</u>
{% endif %}

{% include base_path %}



## TensorACO: Tensorized Ant Colony Optimization for GPU Acceleration
### Advisor: [Prof. Ran Cheng](https://chengran.tech/) | Sept. 2023 till now
(First Author, Under reviewing)

- We propose an ant system tensorization method. It integrates heuristic method values and the pheromone matrices to compute the probability transition matrix, enabling efficient preprocessing while achieving acceleration using function mapping.
- We propose an ant path tensorization method. It parallelizes the serial processing of ant path solutions in the pheromone matrix computation and reduces redundant path cost calculations through an index mapping method.
- We propose an Adaptive Independent Roulette (AdaIR) method. It improves algorithm performance while retaining the benefits of parallelization by incorporating a learning rate hyperparameter to dynamically adjust the tendency of ants to select cities with higher probabilities.
- Compared with the sequential ACO in CPU, a 1921$\times$ acceleration was achieved; AdaIR achieved an additional acceleration of more than 2$\times$.



<embed src="/files/TensorACO2.pdf" width="500" height="375" type="application/pdf">


---

## PoseTransformer: Enhancing Action Recognition via RGB-Skeleton Fusion with Transformer
### Advisor: Dr. Lei Ding | Oct. 2023

- Integrates a unique RGB-skeleton channel fusion model.
- Blending the self-attention mechanism with a transformer.
- Outperforms existing models with an accuracy of **0.955** on the KTH dataset and exhibits remarkable **10% improvement** in accuracy when tested on diverse background settings comparing to the original RGB transformer models.


<embed src="/files/PoseTransformer.pdf" width="500" height="375" type="application/pdf">

---

## Capacitated Arc Routing AI Based on Heuristic Genetic Algorithm
### Dec. 2022

- Developed an algorithm for the Capacitated Arc Routing Problem.
- Introduced a unique crossover operator and shuffle process to optimize solutions, with a focus on reducing local optima.
- Conducted algorithm analysis and experiments on distinct datasets.

<embed src="/files/CARP_Project_Report.pdf" width="500" height="375" type="application/pdf">


---

## [Evolving Machine Intelligence Lab](https://www.emigroup.tech/) of SUSTech 
### Advisor: [Prof. Ran Cheng](https://chengran.tech/) | Jun. 2021 till now

### Research Assistant

- Participated in developing the distributed scalable evolutionary computation intelligent acceleration library [EvoX](https://github.com/EMI-Group/evox).
- Responsible for developing evolutionary algorithms meeting functional programming standards using the JAX library developed by Google.

![Group Meeting](/images/meeting.jpg "Meeting")
Group Meeting

### Project: JAX-based Evolutionary Computation Library EvoX

<embed src="/files/EvoX_Final_Report.pdf" width="500" height="375" type="application/pdf">

---

## Guangdong Youth Big Data and New Media Center 
### Aug. 2020 – Sept. 2020

### Internship - Information Retrieval and Data Analysis

- Collected and processed data from BiliBili and WeChat.
- Generated visual representations to present insights, aiding in decision-making and project planning.
- Due to data confidentiality, a similar project can be referred to in the GitHub Repo: [AnalyzeSOF](https://github.com/skylynf/AnalyzeSOF).


---
