---
layout: page
permalink: /publications/
title: publications
description: 
nav: true
nav_order: 2
---

<!-- _pages/publications.md -->

<!-- Bibsearch Feature -->

{% include bib_search.liquid %}

<div class="publications">

<h2 class="bibliography">Preprints</h2>
{% bibliography --group_by none --query @*[pubtype=preprint]* %}

{% bibliography --query @*[pubtype!=preprint]* %}

</div>
