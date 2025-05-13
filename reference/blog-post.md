Copied from https://andrewhungblog.wordpress.com/2018/04/29/page-curl-shader-breakdown/

# Page Curl Shader Breakdown – Nudgie Dev Diary
Page curl is a fairly common effect in e-reader applications. It looks like this:

![instapaper-4-2-page-curl-screenshot](https://andrewhungblog.wordpress.com/wp-content/uploads/2018/04/instapaper-4-2-page-curl-screenshot.jpg?w=300&h=400)

The effect simulates turning a page of a paperback book, usually in an interactive way where the deformation of the page is affected by the location of your finger on the screen and the direction of your drag. I’m a big fan of skeumorphism in UI’s (contrary to modern design trends), which makes this particular effect very delightful to me.

![reason-600x497](https://andrewhungblog.wordpress.com/wp-content/uploads/2018/04/reason-600x497.jpg?w=840)

Too skeumorphic? Nahhh

From the moment I first saw this effect, I’ve been curious about the math behind it. I finally decided recently to dive in and attempt to implement it as a learning exercise. As per my usual strategy for learning a new topic for which there is likely an abundance of pre-existing literature, I turned to Google for my initial research. I came across a few writeups on the technique (including [this](http://www2.parc.com/istl/groups/uir/publications/items/UIR-2004-10-Hong-DeformingPages.pdf) research paper) but found them to be lacking. Most of them were extremely vague, sometimes with code that was obfuscated to an obnoxious degree. My initial reaction was that the math was simply beyond my current level of understanding. I couldn’t have been more mistaken.

I quickly grew frustrated with trying to reverse-engineer write-only code and decided to try to figure the whole thing out from scratch. It turned out to be far less complicated than I expected and didn’t involve any math beyond geometry and trig. Here’s the end result as a GLSL shader:

![pagecurl](https://andrewhungblog.wordpress.com/wp-content/uploads/2018/04/pagecurl.gif?w=840)

[Here’s](https://www.shadertoy.com/view/ls3cDB) my implementation on shadertoy. Click and drag on the image to see the effect. I’m not going to go too deep into the code itself in the following explanation since it handles a lot of shader-related minutiae (aspect ratio, clamping, etc) and I’d rather focus on the math, but feel free to leave a comment or reach out to me if you’d like me to elaborate further on the GLSL code.

How the Effect Works
--------------------

### High Level Summary

The basic idea behind the effect is that the curl of the page is represented as a cylinder whose left and right edges are parallel to what I’ll call the “curl axis”. The curl axis is the crease that you would get if you folded the page along the base of the curl:

![curl_axis](https://andrewhungblog.wordpress.com/wp-content/uploads/2018/04/curl_axis.png?w=840)

Each page (the current page and the next page) is represented as a different texture passed into the shader. In the fragment shader, the fragment’s position is analyzed to determine where it lies with respect to the cylinder and the curl axis. This information is used to determine both which texture to use and which UV coordinate on that texture to display at the fragment’s position.

This gives us two sub-problems to solve:

1.  Finding the location and orientation of the cylinder.
2.  Determining the texture and UV, based on #1 and the current fragment position.

### Sub-Problem #1: Finding the Curl Axis and the Cylinder

To deform the quad around a cylinder, we need to know the actual location and orientation of the cylinder. This information can be represented in many forms, so it is helpful to consider how we will use this information in sub-problem #2 to determine which form we need it in. The key piece of information we will need is _how far the current fragment is from the curl axis_. This distance alone gives us most of the information we need to choose the correct texture and map the UV in sub-problem #2, so we don’t need to worry about finding the angle of rotation of the cylinder or anything like that. Here’s an illustration of the piece of information that we are trying to find in this step (we’ll call it _d_ from this point onward):

![distance_to_find](https://andrewhungblog.wordpress.com/wp-content/uploads/2018/04/distance_to_find.png?w=840)

_d_ is the distance we want to find

Finding _d_ involves a few different steps. Let’s take it one step at a time.

First, we’ll want to represent the orientation of the curl axis in a way that makes solving for _d_ easy. To do this, we can simply look at the direction in which the user is dragging the screen. If we find the vector between the point where the user placed his finger on the screen (we’ll call this _clickPos)_ and the point to which he has currently dragged his finger (we’ll call this _dragPos_), we can treat the curl axis as a line that is perpendicular to this vector and passes through the _dragPos_. See these images to gain an intuition for why this makes a good curl axis:

![curl_dir](https://andrewhungblog.wordpress.com/wp-content/uploads/2018/04/curl_dir.png?w=840)

_A_ is _clickPos_, _B_ is _dragPos_

We’ll calculate the direction vector (_dir_) as follows:

`vec2 dir = normalize(clickPos - dragPos);`

Now we need to figure out how to represent the fragment (_f_) as a vector so that the dot product actually gives us the length of the projection along the vector to the curl axis. In other words, we need to find the origin point depicted below:

![origin](https://andrewhungblog.wordpress.com/wp-content/uploads/2018/04/origin.png?w=840)

_f_ is an arbitrary fragment

To find that point, we can calculate the intersection of the lefthand side of the page with the direction vector from _dragPos_:

`vec2 origin = clamp(dragPos - dir * dragPos.x / dir.x, 0., 1.);`

Basically, we’re finding out how many instances of _dir_ fit between _dragPos_ and the lefthand side of the screen. We then subtract by that many instances of _dir_, bringing us right up to that edge. The point that we arrive at is the origin point that we’re looking for. We can then find a vector representing _f_ by simply subtracting the origin point from the fragment position.

Now that we have the fragment and the direction vector, we can take the dot product to get the distance along the direction vector.

`float distOfFragmentAlongDirectionVector = dot(fragVec, dir);`

To get the critical piece of information that we need for part #2 (the distance of fragment _from_ the curl axis), we can do the following calculation:

`float distOfFragmentFromCurlAxis = distOfFragmentAlongDirectionVector - distOfCurlAxisAlongDirectionVector;`

Since we’re using _dragPos_ as the curl axis position, the distance between _dragPos_ and the origin calculated previously gives us _distOfCurlAxisAlongDirectionVector_. _distOfFragmentAlongDirectionVector_ is the projected distance that we just calculated by taking the dot product. We now have both terms that we need to execute the subtraction and find the distance of the fragment from the curl axis, which is what we need to proceed to sub-problem #2.

### Sub-Problem #2: Mapping the Point to the Cylinder

Having obtained the distance between the current fragment and the curl axis, we can now properly deform the image along the cylinder. There are three scenarios now that will determine how this deformation calculation is performed. These scenarios depend on the distance calculated in step 1, as well as a pre-configured radius for the page curl cylinder. I’ll quickly summarize these three scenarios below and then go into more detail:

1.  The fragment is ahead of the curl axis and not within the curl radius
2.  The fragment is ahead of the curl axis but within the curl radius
3.  The fragment is behind the curl axis

#### Scenario 1: Fragment is ahead of curl axis and not within radius

Viewed from the side, this scenario looks like this:

![scenario_1](https://andrewhungblog.wordpress.com/wp-content/uploads/2018/04/scenario_1.png?w=840)

In this case, it’s clear that the point doesn’t lie on the curl at all and is completely on the second page. So we can simply sample the texture of the second page without deforming the UV coordinates at all.

#### **Scenario 2: Fragment is ahead of curl axis and within curl radius**

If we’re ahead of the curl axis but within the curl radius, then that means we’re on the curl itself. In this case, we’re definitely on the first page but we could either be on the front side or back side of the page. Here’s what this scenario looks like:

![scenario_2](https://andrewhungblog.wordpress.com/wp-content/uploads/2018/04/scenario_2.png?w=840)

_p1_ and _p2_ represent the possible positions on the page for the fragment. _p1_ is on the front of the page and p2 is on the back of the page, since it’s curled back around and since the viewer is looking down on the page.

To find the actual UV coordinates that _p1_ and _p2_ represent, we can essentially “unroll” the curl and see where _p1_ and _p2_ would be if the page was laid flat. We can unroll it by calculating the distance along the circumference from the curl axis to the point. Here’s where the geometry and trig come in.

![unroll](https://andrewhungblog.wordpress.com/wp-content/uploads/2018/04/unroll.png?w=840)

We know that the circumference of a circle is ![2\pi*r ](https://s0.wp.com/latex.php?latex=2%5Cpi%2Ar+&bg=ffffff&fg=7f8d8c&s=2&c=20201002) and we know that there are ![2\pi ](https://s0.wp.com/latex.php?latex=2%5Cpi+&bg=ffffff&fg=7f8d8c&s=2&c=20201002) radians in a circle. If we can calculate ![\theta ](https://s0.wp.com/latex.php?latex=%5Ctheta+&bg=ffffff&fg=7f8d8c&s=2&c=20201002) in the diagram above, then we can calculate the distance to _p1_ along the circumference by taking the proportion of ![\theta ](https://s0.wp.com/latex.php?latex=%5Ctheta+&bg=ffffff&fg=7f8d8c&s=2&c=20201002) to ![2\pi ](https://s0.wp.com/latex.php?latex=2%5Cpi+&bg=ffffff&fg=7f8d8c&s=2&c=20201002) and multiplying this by the circumference. This works because rotating ![\frac{1}{n}^{th} ](https://s0.wp.com/latex.php?latex=%5Cfrac%7B1%7D%7Bn%7D%5E%7Bth%7D+&bg=ffffff&fg=7f8d8c&s=2&c=20201002) of the way around a circle is equivalent to traveling ![\frac{1}{n}^{th} ](https://s0.wp.com/latex.php?latex=%5Cfrac%7B1%7D%7Bn%7D%5E%7Bth%7D+&bg=ffffff&fg=7f8d8c&s=2&c=20201002) of the distance around its circumference.

We can calculate ![\theta ](https://s0.wp.com/latex.php?latex=%5Ctheta+&bg=ffffff&fg=7f8d8c&s=2&c=20201002) fairly easily by using some high school trigonometry. We know the H and the O in SOH CAH TOA – H is the radius, which is simply a pre-determined value. O is the distance that we found in sub-problem #1.

![\sin(\theta) = \frac{d}{r} ](https://s0.wp.com/latex.php?latex=%5Csin%28%5Ctheta%29+%3D+%5Cfrac%7Bd%7D%7Br%7D+&bg=ffffff&fg=7f8d8c&s=2&c=20201002)  
![\theta = \arcsin(\frac{d}{r}) ](https://s0.wp.com/latex.php?latex=%5Ctheta+%3D+%5Carcsin%28%5Cfrac%7Bd%7D%7Br%7D%29+&bg=ffffff&fg=7f8d8c&s=2&c=20201002)

We can thus find the distance to p1 as follows:

![d1 = \frac{\theta}{2\pi} * 2\pi r ](https://s0.wp.com/latex.php?latex=d1+%3D+%5Cfrac%7B%5Ctheta%7D%7B2%5Cpi%7D+%2A+2%5Cpi+r+&bg=ffffff&fg=7f8d8c&s=2&c=20201002)  
![d1 = \theta * r ](https://s0.wp.com/latex.php?latex=d1+%3D+%5Ctheta+%2A+r+&bg=ffffff&fg=7f8d8c&s=2&c=20201002)

The distance to _p2_ is calculated in a similar way, only we replace theta by ![\pi - \theta ](https://s0.wp.com/latex.php?latex=%5Cpi+-+%5Ctheta+&bg=ffffff&fg=7f8d8c&s=2&c=20201002):

![d2 = \frac{\pi - \theta}{2\pi} * 2\pi r ](https://s0.wp.com/latex.php?latex=d2+%3D+%5Cfrac%7B%5Cpi+-+%5Ctheta%7D%7B2%5Cpi%7D+%2A+2%5Cpi+r+&bg=ffffff&fg=7f8d8c&s=2&c=20201002)  
![d2 = (\pi -\theta) * r ](https://s0.wp.com/latex.php?latex=d2+%3D+%28%5Cpi+-%5Ctheta%29+%2A+r+&bg=ffffff&fg=7f8d8c&s=2&c=20201002)

Now that we’ve solved for _d1_ and _d2_, we can find the values of the unrolled _p1_ and _p2_ by multiplying _d1_ and _d2_ by _dir_ and adding each product to the point where the direction vector to the fragment would’ve intersected with the curl axis (we’ll call this point _linePoint_ – you can find it by moving the fragment position towards the curlAxis by _dir_ \* _distOfFragmentFromCurlAxis_, where the latter variable is the critical piece of info we found in sub-problem #1).

`vec2 linePoint = fragmentPos - distOfFragmentFromCurlAxis * dir;   vec2 p1 = linePoint + dir * d1;   vec2 p2 = linePoint + dir * d2;`

To determine whether to use _p1_ (the front side) or _p2_ (the back side), we simply check to see whether or not the UV coordinate at _p2_ is within the UV bounds of \[0, 1\]. If it is outside of these boundaries, then _p2_ doesn’t actually exist at all on the first page and we therefore use _p1_ as the UV coordinate. See the following diagram to gain intuition for why this makes sense:

![out_of_bounds](https://andrewhungblog.wordpress.com/wp-content/uploads/2018/04/out_of_bounds.png?w=840)

In the above image, we look at the unrolled _p2_ values for several fragments. Because the page is a rectangle, some of the unrolled points will lie beyond the page boundaries. For these fragments, we’ll use _p1_ to get the UV coordinates rather than _p2_, since _p2_ is no longer on the page.

#### Scenario 3: The fragment is behind the curl axis

Here’s a visualization of scenario 3, assuming that the curled page is straight once it is behind the curl axis:

![scenario_3](https://andrewhungblog.wordpress.com/wp-content/uploads/2018/04/scenario_3.png?w=840)

We can find the UV here using a similar technique to scenario #2 – unroll the page and see where the point would lay on the unrolled page. If the unrolled point is within the UV bounds \[0, 1\], then we use that as the UV. Otherwise we just use the original UV of the fragment. Finding the unrolled UV is a little bit easier in this case since we don’t have to do any trig – we can get the distance to _p_ by just adding half of the circumference to the distance of the fragment from the curl axis (that wonderful number we calculated in the very first sub-problem).

Like the previous scenario, we ignore the UV coord for the backside of the page if it is out of bounds and instead just use the original UV.

### Miscellaneous Tweaks

And there you have it. To see the nitty gritty implementation details, feel free to check out my [shadertoy implementation](https://www.shadertoy.com/view/ls3cDB). As far as I know, this is about as simple as this effect can get (< 50 lines of code for the whole thing). No crazy mesh deformations or insanely complex math – just a single quad with a bit of trig. There are a few things going on in there that I didn’t go over in this post, since they’re not fundamental to the primary deformation effect:

*   Adding a pseudo-shadow cast by the curled page.
*   Doing some clamping to make sure the page always stays attached to the “spine” of the book on the lefthand side.

I’ve pretty much satisfied my curiosity with this effect, but there are a few small additions that I may add to the shader in the future:

*   Anti-aliasing of page edges.
*   Turning to the previous page (rather than only the next page).