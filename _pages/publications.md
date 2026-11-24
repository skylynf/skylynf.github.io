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

{% bibliography --query @*[pubtype!=preprint && pubtype!=other]* %}

{% comment %}
Others is empty while both IEEE Access papers (huang2026rethinking, li2026robust)
are hidden={true}. Restore this block to show the group again.
<h2 class="bibliography">Others</h2>
{% bibliography --group_by none --query @*[pubtype=other]* %}
{% endcomment %}

</div>
