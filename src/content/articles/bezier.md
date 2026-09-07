---
title: "Bezier Cursive"
date: 2026-07-22
summary: Implementation of Bezier is easy.
tags: [essay]
draft: false
---

Look at the recursive part of the de Casteljau's algorithm to understand how Bezier cursive is constructed.

```cpp
cv::Point2f recursive_bezier(const std::vector<cv::Point2f> &control_points, float t) 
{
    // DONE: Implement de Casteljau's algorithm
    if (control_points.size() == 1) return control_points[0];
    std::vector<cv::Point2f> new_control(control_points.size() - 1);
    for (size_t i = 0; i < new_control.size(); i++) {
        new_control[i] = t * control_points[i] + (1 - t) * control_points[i + 1];
    }
    return recursive_bezier(new_control, t);
}

void bezier(const std::vector<cv::Point2f> &control_points, cv::Mat &window) 
{
    // DONE: Iterate through all t = 0 to t = 1 with small steps, and call de Casteljau's 
    // recursive Bezier algorithm.
    for (float t = 0.0; t <= 1.0; t += 0.001) {
        auto point = recursive_bezier(control_points, t);
        window.at<cv::Vec3b>(point.y, point.x)[1] = 255;
    }
}
```

