---
layout: project
title: Isthmus
description: Bridging supervision islands restores uncertainty and stability in one-step flows.
img: assets/img/isthmus/card.png
importance: 1
category: generative models
permalink: /projects/isthmus/
extra_js:
  - /assets/js/isthmus.js
---

<div class="isthmus">

<header class="isthmus-hero">
  <p class="isthmus-kicker">Preprint · arXiv:2611.23616</p>
  <h1>Isthmus</h1>
  <p class="isthmus-subtitle">Bridging Supervision Islands Restores Uncertainty and Stability in One-Step Flows</p>
  <p class="isthmus-authors">
    <span class="isthmus-me">Luming Yang</span><sup>*,1</sup>,
    Siqing Li<sup>*,1</sup>,
    Haoxian Liu<sup>*</sup>,
    Zhenyu Bu<sup>1</sup>,
    Jiazheng Zhu<sup>1</sup>,
    Alper Yilmaz<sup>†,1</sup>
  </p>
  <p class="isthmus-affil">
    <sup>1</sup> The Ohio State University<br>
    <sup>*</sup> Equal contribution &ensp; <sup>†</sup> Corresponding author
  </p>
  <div class="isthmus-links">
    <a href="https://arxiv.org/abs/2611.23616">arXiv</a>
    <a href="https://arxiv.org/pdf/2611.23616">PDF</a>
    <a href="#isthmus-bibtex">BibTeX</a>
  </div>
</header>

<section class="isthmus-stage" id="isthmus-stage" aria-label="Interactive illustration of supervision islands and the isthmus">
  <div class="isthmus-stage-head">
    <h2 class="isthmus-stage-title">The idea, in motion</h2>
    <div class="isthmus-modes" role="group" aria-label="Training setup">
      <button type="button" class="isthmus-mode" data-isthmus-mode="standard" aria-pressed="false">Standard</button>
      <button type="button" class="isthmus-mode" data-isthmus-mode="island" aria-pressed="false">Island</button>
      <button type="button" class="isthmus-mode is-active" data-isthmus-mode="isthmus" aria-pressed="true">Isthmus</button>
    </div>
  </div>
  <div class="isthmus-viz">
    <div class="isthmus-panel">
      <svg id="isthmus-triangle" class="isthmus-svg" viewBox="0 0 360 360" role="img" aria-label="Time triangle of start and end times. Training pairs appear in the interior; the isthmus places pairs along the top landing edge, connecting the one-step corner to the diagonal."></svg>
    </div>
    <div class="isthmus-panel">
      <svg id="isthmus-samples" class="isthmus-svg" viewBox="0 0 360 360" role="img" aria-label="Particles jumping from a source cloud to data space. Open circles mark 64-step reference samples; filled circles mark one-step samples, which collapse without an isthmus and keep their spread with one."></svg>
    </div>
  </div>
  <p class="isthmus-caption" id="isthmus-caption"></p>
  <div class="isthmus-metrics">
    <span>IXI brain MRI, one step: <strong id="isthmus-metric-label"></strong></span>
    <span>Calibration \(V/B\) = <strong id="isthmus-metric-vb"></strong></span>
    <span>Correlation \(\rho\) = <strong id="isthmus-metric-rho"></strong></span>
  </div>
</section>

<section class="isthmus-tldr isthmus-reveal">
  <h2>TL;DR</h2>
  <p>
    One-step flow maps are increasingly used as posterior samplers, where the point of sampling is the uncertainty that the samples carry.
    We find that the one-step jump of a standard flow-map model loses this uncertainty and becomes less stable than the same network sampled in many steps.
    Both failures come from where training places its pairs of start and end times: the one-step pair sits on a <em>supervision island</em>, cut off from the data-anchored diagonal.
    An <em>isthmus</em> spends 5% of the training pairs along the landing edge that joins this pair to the diagonal.
    The network, the loss, and inference are unchanged, and there is no added cost.
    On brain MRI, the isthmus restores one-step calibration to 0.96 and the correlation with 64-step samples to 0.93.
  </p>
</section>

<section class="isthmus-section isthmus-reveal" id="abstract">
  <h2>Abstract</h2>
  <p>
    One-step flow maps are increasingly used as posterior samplers, where the point of sampling is the uncertainty that the samples carry.
    We find that the one-step sampler loses this uncertainty and becomes less stable.
    Compared with multi-step samples of the same network, its samples lose variance and decorrelate.
    Supervising the one-step jump directly makes this worse; the samples collapse further toward the conditional mean and break down when training is extended.
    We trace both failures to the locations where training places its pairs of start and end times.
    Only pairs on the diagonal of the time triangle receive targets from data, and the pair used for one-step sampling is either left unsupervised or supervised on an <em>island</em>, a set of pairs that the self-consistency identity does not connect to the diagonal, where the objective neither determines the one-step map nor anchors its training.
  </p>
  <p>
    We bridge the island with an <em>isthmus</em>, which places 5% of the training pairs along the whole edge of the triangle that joins the one-step pair to the diagonal.
    The error of the one-step map is then bounded by the self-consistency residual along this edge.
    With the network, the loss and the inference code unchanged and at no added cost, the isthmus improves one-step sampling across several flow-map objectives, in MRI reconstruction, face inpainting, and unconditional generation on CIFAR-10 and ImageNet \(32\times 32\).
    On brain MRI, it restores one-step calibration to 0.96 and the correlation with multi-step samples to 0.93; both vary far less across seeds, and the agreement holds when training is extended to three times its length.
  </p>
</section>

<section class="isthmus-section isthmus-reveal" id="idea">
  <h2>Key idea</h2>
  <p>
    A flow-map network can jump from the source to the data in one step, or it can integrate the same flow in many short steps.
    If the one-step map is faithful, the two samplers should agree, both in their samples and in their spread.
    In the paper they do not: on brain MRI, the 64-step sampler of a standard MeanFlow model is close to calibrated, while the one-step samples of the same network are already under-dispersed (calibration \(0.67\), where \(1\) is exact) and only partly correlated with the 64-step samples (\(\rho = 0.58\)).
    Supervising the one-step jump directly makes this worse and collapses the samples toward the conditional mean (calibration \(0.26\)).
    When training is extended, the collapsed one-step sampler can break down, while the 64-step sampler of the same network stays intact.
  </p>
  <p>
    Both symptoms come from the geometry of training pairs.
    Training draws a start time \(r\) and an end time \(t\) from the triangle \(0 \le r \le t \le 1\).
    Only the diagonal \(r = t\) receives targets from the data, and the mean-flow identity passes this information along rows of constant end time.
    One-step sampling is the corner \((r, t) = (0, 1)\), which sits at one end of the <em>landing edge</em> \(t = 1\).
    The standard time sampler places no training pairs on this edge, so the corner is unsupervised.
    A pair placed at the corner alone is a <em>supervision island</em>: the identity does not connect it to the diagonal, the one-step map is not uniquely determined (an arbitrary map composed with the true flow still has zero residual), and its training targets rest on untrained pairs.
  </p>
  <p>
    The remedy is a thin bridge.
    The error of the one-step map is bounded by the residual of the identity along the landing edge, so training controls this error once its pairs cover the whole edge.
    An <em>isthmus</em> is the simplest such sampler: with probability \(5\%\), a training pair is replaced by \(r \sim \mathcal{U}(0,1)\), \(t = 1\).
    Only the time sampler changes.
  </p>

  <figure class="isthmus-figure">
    <img src="{{ '/assets/img/isthmus/fig1-overview.png' | relative_url }}" alt="Figure 1 from the paper. Panels (a) and (b) show the time triangle: a supervision island at the one-step corner versus an isthmus along the landing edge. Panels (c) and (d) compare agreement and training stability. Panel (e) shows per-pixel standard deviation of MRI samples.">
    <figcaption>
      <strong>Figure 1.</strong> Supervision islands and the isthmus.
      <strong>(a)</strong> Each point is a jump from start time \(r\) to end time \(t\); one-step sampling is the top-left corner, from source to data.
      The standard time sampler places no pairs on \(t = 1\), so supervision added only at the corner has no path to the diagonal.
      <strong>(b)</strong> An isthmus spends 5% of the pairs on the landing edge, linking the corner to the diagonal.
      <strong>(c)</strong> Training run on brain MRI comparing one-step with 64-step samples.
      <strong>(d)</strong> The corner point breaks down at 80k iterations.
      <strong>(e)</strong> Per-pixel standard deviation of 16 samples.
      The corner point loses the uncertainty of the 64-step reference; the isthmus keeps it.
    </figcaption>
  </figure>

  <figure class="isthmus-figure">
    <img src="{{ '/assets/img/isthmus/fig2-theory.png' | relative_url }}" alt="Figure 2 from the paper. Schematic of undetermined uncertainty on a supervision island, unanchored training, and how the bridge of the one-step corner follows the time variable that the objective differentiates.">
    <figcaption>
      <strong>Figure 2.</strong> Why an island fails, and which edge is the bridge.
      On an island the residual can vanish for an arbitrary map, so the one-step variance is not determined, and training at the corner is off-policy with respect to the diagonal.
      The isthmus makes the chain on-policy along the landing edge.
      Which edge bridges the corner depends on the objective: the landing edge for identities that differentiate in the start time \(r\) (MeanFlow, iMF), and the launch edge for identities that differentiate in the end time \(t\) (LSD).
    </figcaption>
  </figure>
</section>

<section class="isthmus-section isthmus-reveal" id="method">
  <h2>Method</h2>
  <p>
    In its default form the isthmus is a one-line change to any base time sampler with \(r \le t\).
    With probability \(\pi_{\mathrm{isth}} = 5\%\), the pair is replaced by a jump that starts at a uniform time and lands on the data.
    The new pairs are trained with the unchanged mean-flow target.
    Pairs are replaced rather than added, so the cost per iteration is unchanged.
    The analysis requires only \(\pi_{\mathrm{isth}} > 0\); shares from 2.5% to 10% perform alike in the paper’s ablations.
  </p>
  <div class="isthmus-code">
    <pre><code>r, t = base_sampler(n)        # any sampler, r &lt;= t
isth = rand(n) &lt; 0.05         # 5% of the examples
r = where(isth, rand(n), r)   # start ~ U(0, 1)
t = where(isth, 1.0, t)       # end on the data</code></pre>
  </div>
  <p>
    Because the base sampler has no pair on the landing edge, the one-step error is bounded by the mean-square residual over the isthmus pairs.
    A small error implies closeness to the data distribution in Wasserstein-2 distance and agreement with the multi-step samples.
    Calibration further requires an error that is small relative to the posterior variance, which the bound does not itself provide; it is tested empirically.
  </p>
</section>

<section class="isthmus-section isthmus-reveal" id="results">
  <h2>Main results</h2>
  <p>
    The experiments change only the time sampler.
    The main setting is posterior sampling for \(8\times\) accelerated MRI on IXI brain slices, with a conditional U-Net trained with the MeanFlow loss for 40k iterations, reported as means over three training seeds.
    The same comparisons are repeated on fastMRI knee data and CelebA inpainting, and with the official MeanFlow code on unconditional CIFAR-10 and ImageNet \(32\times 32\).
  </p>
  <p>
    With 64 steps, every network in the comparison is close to calibrated (\(V/B = 0.92\)–\(1.03\)), so the network itself has learned the uncertainty of the posterior.
    Without an isthmus, the same networks in one step reach only \(V/B = 0.56\)–\(0.84\).
    With the isthmus, every recipe reaches paired correlation \(\rho \ge 0.93\), and MeanFlow and SNaP become the only one-step samplers that are both consistent with 64 steps and calibrated (\(V/B = 0.96\) and \(0.95\)).
  </p>

  <div class="isthmus-table-wrap">
    <table class="isthmus-table">
      <caption>
        One-step posterior sampling on IXI brain MRI (\(8\times\)).
        Calibration \(V/B\) is the variance of the samples divided by the squared error of their mean (\(1\) is exact, \(0\) is a regressor).
        \(\rho\) is the correlation between a one-step sample and the 64-step sample from the same noise.
        Numbers from the paper (overall table and the supervised-region table).
      </caption>
      <thead>
        <tr>
          <th>Training pairs</th>
          <th class="num">\(V/B \to 1\)</th>
          <th class="num">\(\rho \to 1\)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>MeanFlow, no extra pairs</td>
          <td class="num">0.67</td>
          <td class="num">0.58</td>
        </tr>
        <tr>
          <td>Corner point (island)</td>
          <td class="num">0.26</td>
          <td class="num">0.74</td>
        </tr>
        <tr>
          <td>Launch strip</td>
          <td class="num">0.17</td>
          <td class="num">0.77</td>
        </tr>
        <tr>
          <td>Landing strip</td>
          <td class="num">0.83</td>
          <td class="num">0.93</td>
        </tr>
        <tr class="isthmus-ours">
          <td>Isthmus (ours)</td>
          <td class="num">0.96</td>
          <td class="num">0.93</td>
        </tr>
        <tr class="isthmus-ref">
          <td>64-step reference</td>
          <td class="num">0.96</td>
          <td class="num">1</td>
        </tr>
      </tbody>
    </table>
  </div>

  <figure class="isthmus-figure">
    <img src="{{ '/assets/img/isthmus/fig3-qualitative.png' | relative_url }}" alt="Figure 3 from the paper. Brain MRI and CIFAR-10 one-step samples with and without the isthmus, compared with 64-step samples and per-pixel standard deviation maps.">
    <figcaption>
      <strong>Figure 3.</strong> One-step samples with and without the isthmus.
      With the isthmus, the one-step samples and their per-pixel standard deviation match those of 64 steps.
      <strong>(a)</strong> IXI brain MRI. Both models receive the same measurement and the same source draws; the standard deviation is taken over 16 samples.
      Without the isthmus, the one-step MRI sample is noisier than its 64-step counterpart, and its standard deviation is scattered rather than concentrated on anatomical edges.
      <strong>(b)</strong> Unconditional CIFAR-10, same 16 noises.
      One-step samples of the standard recipe lose fine detail; with the isthmus they stay close to the 64-step samples (one-step FID 19.2).
    </figcaption>
  </figure>

  <p>
    Moving the same 5% of pairs between regions of the triangle isolates the effect of placement.
    The isthmus is the only region whose one-step samples are both consistent with 64 steps and calibrated, with \(V_1/B_1 = 0.96\) on IXI — the same calibration as 64 steps — and it is also the best region on the knee (\(V_1/B_1 = 0.83\), \(\kappa_{\mathrm{f}} = 0.67\)).
    Islands fail in the other direction: they can raise correlation but shrink the spread (\(V_1/B_1 = 0.26\) at the corner point, \(0.17\) on the launch strip).
    The landing strip, which covers only the first 0.3 of the landing edge, comes in second.
    On CelebA inpainting, the isthmus keeps the one-step spread close to 64 steps (\(V_1/V_{64} = 0.91\)), while the corner point collapses it to 0.37 and later breaks down under longer training.
  </p>

  <div class="isthmus-table-wrap">
    <table class="isthmus-table">
      <caption>
        Unconditional generation with the official MeanFlow code, one-step FID.
        CIFAR-10 and ImageNet \(32\times 32\) numbers from the paper.
        ImageNet figures are means \(\pm\) s.d.
      </caption>
      <thead>
        <tr>
          <th>Method</th>
          <th class="num">CIFAR-10 FID<sub>1</sub> \(\downarrow\)</th>
          <th class="num">ImageNet 32 FID<sub>1</sub> \(\downarrow\)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>MeanFlow</td>
          <td class="num">58.7</td>
          <td class="num">46.2 ± 12.6</td>
        </tr>
        <tr class="isthmus-ours">
          <td>+ isthmus (ours)</td>
          <td class="num">19.2</td>
          <td class="num">34.8 ± 1.5</td>
        </tr>
      </tbody>
    </table>
  </div>

  <figure class="isthmus-figure">
    <img src="{{ '/assets/img/isthmus/fig4-evidence.png' | relative_url }}" alt="Figure 4 from the paper. Analysis of where islands fail, calibration versus number of steps, agreement per frequency band, bridge length, longer training on MRI, spread on CelebA, and qualitative CelebA samples.">
    <figcaption>
      <strong>Figure 4.</strong> Analysis of islands and the isthmus.
      Panels (a)–(e) are on IXI brain MRI (\(8\times\)); (f) and (g) are on CelebA.
      Islands fail only for jumps that start near the source, and the corner point breaks down under longer training, while the isthmus stays consistent with 64 steps throughout.
      The corner-point run on MRI breaks down at 80k iterations; the isthmus remains aligned when training is extended.
    </figcaption>
  </figure>
</section>

<section class="isthmus-section isthmus-reveal" id="isthmus-bibtex">
  <h2>BibTeX</h2>
  <div class="isthmus-bib">
    <button type="button" class="isthmus-copy" id="isthmus-copy-bib" aria-label="Copy BibTeX">Copy</button>
    <pre id="isthmus-bibtex-text"><code>@article{yang2026isthmus,
  title={Isthmus: Bridging Supervision Islands Restores Uncertainty and Stability in One-Step Flows},
  author={Yang, Luming and Li, Siqing and Liu, Haoxian and Bu, Zhenyu and Zhu, Jiazheng and Yilmaz, Alper},
  journal={arXiv preprint arXiv:2611.23616},
  year={2026}
}</code></pre>
  </div>
</section>

</div>
