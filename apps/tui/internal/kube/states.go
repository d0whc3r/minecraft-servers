// Deployment state polling: the k8s counterpart of docker.States. Server
// deployments carry the part-of label, so one kubectl call lists them all.
package kube

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/d0whc3r/minecraft-servers/apps/tui/internal/domain"
)

type deploymentList struct {
	Items []deploymentItem `json:"items"`
}

type deploymentItem struct {
	Metadata struct {
		Name              string `json:"name"`
		CreationTimestamp string `json:"creationTimestamp"`
	} `json:"metadata"`
	Spec struct {
		Replicas *int `json:"replicas"`
	} `json:"spec"`
	Status struct {
		ReadyReplicas int `json:"readyReplicas"`
		Conditions    []struct {
			Type               string `json:"type"`
			LastTransitionTime string `json:"lastTransitionTime"`
		} `json:"conditions"`
	} `json:"status"`
}

// States maps server name (release name without the mc- prefix) to the
// deployment state, translated into the container vocabulary the dashboard
// merges over the config rows.
func States() (map[string]domain.ContainerState, error) {
	out, err := kubectl(context.Background(), "get", "deployments",
		"--namespace", Namespace(),
		"--selector", partOfLabel,
		"--output", "json")
	if err != nil {
		return nil, fmt.Errorf("kubectl get deployments: %w", err)
	}

	var list deploymentList
	if err := json.Unmarshal([]byte(out), &list); err != nil {
		return nil, fmt.Errorf("cannot parse kubectl output: %w", err)
	}

	states := make(map[string]domain.ContainerState, len(list.Items))
	for _, item := range list.Items {
		name := trimReleasePrefix(item.Metadata.Name)
		if name == "" {
			continue
		}
		desired, ready := item.desired(), item.ready()
		state := domain.ContainerState{}
		switch {
		case desired == 0:
			// Scaled to 0: the release (data, route) stays, the pod does not.
			state.State = "exited"
			state.Status = "Stopped (scaled to 0)"
		case ready >= desired:
			state.State = "running"
			state.Status = item.statusText(fmt.Sprintf("Ready %d/%d", ready, desired))
			state.Health = "healthy"
		default:
			state.State = "running"
			state.Status = item.statusText(fmt.Sprintf("%d/%d ready", ready, desired))
			state.Health = "starting"
		}
		states[name] = state
	}
	return states, nil
}

func (d deploymentItem) desired() int {
	if d.Spec.Replicas == nil {
		return 1
	}
	return *d.Spec.Replicas
}

func (d deploymentItem) ready() int { return d.Status.ReadyReplicas }

// statusText appends the pod uptime (from the Ready condition's transition
// time) to the readiness detail, e.g. "Ready 1/1, up 2d3h".
func (d deploymentItem) statusText(detail string) string {
	for _, c := range d.Status.Conditions {
		if c.Type != "Ready" || c.LastTransitionTime == "" {
			continue
		}
		if since, err := time.Parse(time.RFC3339, c.LastTransitionTime); err == nil {
			return detail + ", up " + humanizeDuration(time.Since(since))
		}
		break
	}
	return detail
}

func trimReleasePrefix(name string) string {
	const prefix = "mc-"
	if len(name) > len(prefix) && name[:len(prefix)] == prefix {
		return name[len(prefix):]
	}
	return ""
}

// humanizeDuration renders an uptime compactly ("3d4h", "18m", "42s").
func humanizeDuration(d time.Duration) string {
	switch {
	case d >= 24*time.Hour:
		return fmt.Sprintf("%dd%dh", int(d.Hours()/24), int(d.Hours())%24)
	case d >= time.Hour:
		return fmt.Sprintf("%dh%dm", int(d.Hours()), int(d.Minutes())%60)
	case d >= time.Minute:
		return fmt.Sprintf("%dm", int(d.Minutes()))
	default:
		return fmt.Sprintf("%ds", int(d.Seconds()))
	}
}
