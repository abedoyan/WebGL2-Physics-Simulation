#version 300 es

precision highp float;

uniform vec3 lam_lightdir;
uniform vec3 bp_halfway;
uniform vec3 lightcolor;

in vec3 fnormal;
in vec3 fcolor;

out vec4 fragColor;

void main() {
    vec3 normal = normalize(fnormal);
    float lambert = max(0.0, dot(lam_lightdir, normal));
    float blinnphong = pow(max(0.0, dot(bp_halfway, normal)), 200.0);
    
    vec4 color = vec4(fcolor.rgb, 1.0);

    // lighting options
    vec4 difFragColor = vec4(color.rgb * (lightcolor * lambert), color.a);
    //vec4 specFragColor = vec4(color.rgb * (lightcolor * lambert) + (lightcolor * blinnphong)*5.0, color.a);
    
    // determine which lighting to use
    fragColor = difFragColor;
}