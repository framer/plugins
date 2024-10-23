import { useState } from "react"
import { useAuditQuery, useEditAuditMutation } from "@/api"
import { Button } from "@/components/Button"

export function AuditSettingsPage() {
    const { data: settings, isLoading } = useAuditQuery({
        formatSnapshotData: false,
    })
    const editAuditMutation = useEditAuditMutation()
    const [formData, setFormData] = useState({
        scheduleDay: 1,
        allow: [""],
        disallow: [""],
        pageLimit: 100,
        userAgentType: 2,
        respectCrawlDelay: true,
    })

    if (isLoading) {
        return <p>Loading audit....</p>
    }

    if (!settings) {
        return (
            <div className="flex-1 flex items-center justify-center text-tertiary">
                Failed to load audit settings. Ensure you have site audit enabled.
            </div>
        )
    }

    return (
        <section className="col">
            <div className="col pb-15">
                <h6>Basic</h6>
                <div className="input-container">
                    <p>Limit</p>
                    <select
                        name="pageLimit"
                        onChange={e =>
                            setFormData(prevFormData => ({
                                ...prevFormData,
                                pageLimit: parseInt(e.target.value),
                            }))
                        }
                        defaultValue={settings.pages_limit}
                    >
                        <option>100</option>
                        <option>200</option>
                        <option>500</option>
                        <option>1000</option>
                        <option>5000</option>
                        <option>10000</option>
                        <option>15000</option>
                        <option>20000</option>
                        <option>100000</option>
                    </select>
                </div>
                <div className="input-container">
                    <p>Frequency</p>
                    <select
                        name="scheduleDelay"
                        defaultValue={settings.scheduleDay}
                        onChange={e =>
                            setFormData(prevData => ({
                                ...prevData,
                                scheduleDay: Number(e.target.value),
                            }))
                        }
                    >
                        <option value={1}>Weekly, Every Monday</option>
                        <option value={2}>Weekly, Every Tuesday</option>
                        <option value={3}>Weekly, Every Wednesday</option>
                        <option value={4}>Weekly, Every Thursday</option>
                        <option value={5}>Weekly, Every Friday</option>
                        <option value={6}>Weekly, Every Saturday</option>
                        <option value={7}>Weekly, Every Sunday</option>
                        <option value={0}>Once</option>
                    </select>
                </div>
                <hr />
                <h6>Crawler</h6>
                <div className="input-container">
                    <p>Agent</p>
                    <select
                        name="userAgentType"
                        defaultValue={settings.user_agent_type}
                        onChange={e =>
                            setFormData(prevData => ({
                                ...prevData,
                                userAgentType: Number(e.target.value),
                            }))
                        }
                    >
                        <option value={2}>GoogleBot Desktop</option>
                        <option value={3}>GoogleBot Mobile</option>
                    </select>
                </div>
                <div className="input-container">
                    <p>Delay</p>
                    <select
                        name="respectCrawlDelay"
                        defaultValue={settings.respectCrawlDelay ? "true" : "false"}
                        onChange={e =>
                            setFormData(prevData => ({
                                ...prevData,
                                respectCrawlDelay: e.target.value === "true" ? true : false,
                            }))
                        }
                    >
                        <option value="true">1 URL per 2s</option>
                        <option value="false">Follow robots.txt</option>
                    </select>
                </div>
                <hr />
                <h6>URL</h6>
                <div className="input-container">
                    <p>Allow</p>
                    <input
                        placeholder="/pizza, /order, /about"
                        name="allow"
                        onChange={e =>
                            setFormData(prevData => ({
                                ...prevData,
                                allow: e.target.value.split(",").map(path => path.trim()),
                            }))
                        }
                        defaultValue={settings.mask_allow.join(", ")}
                    />
                </div>
                <div className="input-container">
                    <p>Disallow</p>
                    <input
                        placeholder="/pizza, /order, /about"
                        name="disallow"
                        onChange={e =>
                            setFormData(prevData => ({
                                ...prevData,
                                disallow: e.target.value.split(",").map(path => path.trim()),
                            }))
                        }
                        defaultValue={settings.mask_disallow.join(", ")}
                    />
                </div>
            </div>
            <hr />
            <Button onClick={() => editAuditMutation.mutate(formData)} isPending={editAuditMutation.isPending}>
                Save
            </Button>
        </section>
    )
}
