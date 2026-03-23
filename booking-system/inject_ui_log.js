const fs = require('fs');
const path = 'components/CallCenterAgent.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetFunctionBlock = `            // Function calling
            if (type === 'response.function_call_arguments.done') {
                const { call_id, name, arguments: argsString } = event;
                setAgentStatus('Checking ' + name + '...');
                
                try {
                    const argsObj = JSON.parse(argsString);
                    
                    fetch('/api/call-center/tools', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            tool: name as string,
                            args: argsObj,
                            customerName: user?.name,
                            customerPhone: user?.phone,
                            customerEmail: user?.email,
                            customerGender: user?.gender
                        })
                    }).then(res => res.json()).then(result => {
                        if (dcRef.current) {
                            dcRef.current.send(JSON.stringify({
                                type: 'conversation.item.create',
                                item: {
                                    type: 'function_call_output',
                                    call_id: call_id,
                                    output: JSON.stringify(result)
                                }
                            }));
                            dcRef.current.send(JSON.stringify({ type: 'response.create' }));
                        }
                    }).catch(err => {
                        if (dcRef.current) {
                            dcRef.current.send(JSON.stringify({
                                type: 'conversation.item.create',
                                item: {
                                    type: 'function_call_output',
                                    call_id: call_id,
                                    output: JSON.stringify({ success: false, message: 'Tool execution failed' })
                                }
                            }));
                            dcRef.current.send(JSON.stringify({ type: 'response.create' }));
                        }
                    });
                } catch (e) {
                    console.error('Function call error', e);
                }
            }`;

const debugFunctionBlock = `            // Function calling
            if (type === 'response.function_call_arguments.done') {
                const { call_id, name, arguments: argsString } = event;
                setAgentStatus('Checking tool: ' + name);
                setChatLog((prev) => [...prev, { role: 'assistant', content: \`[SYSTEM] Triggered \${name}\` }]);
                
                try {
                    const argsObj = JSON.parse(argsString as string);
                    
                    fetch('/api/call-center/tools', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            tool: name as string,
                            args: argsObj,
                            customerName: user?.name,
                            customerPhone: user?.phone,
                            customerEmail: user?.email,
                            customerGender: user?.gender
                        })
                    }).then(res => {
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        return res.json();
                    }).then(result => {
                        setChatLog((prev) => [...prev, { role: 'assistant', content: \`[SYSTEM] Received \${name} output\` }]);
                        if (dcRef.current) {
                            dcRef.current.send(JSON.stringify({
                                type: 'conversation.item.create',
                                item: {
                                    type: 'function_call_output',
                                    call_id: call_id,
                                    output: JSON.stringify(result)
                                }
                            }));
                            dcRef.current.send(JSON.stringify({ type: 'response.create' }));
                        }
                    }).catch(err => {
                        console.error('Fetch error:', err);
                        setChatLog((prev) => [...prev, { role: 'assistant', content: \`[SYSTEM] Fetch Error \${name}: \${err.message}\` }]);
                        if (dcRef.current) {
                            dcRef.current.send(JSON.stringify({
                                type: 'conversation.item.create',
                                item: {
                                    type: 'function_call_output',
                                    call_id: call_id,
                                    output: JSON.stringify({ success: false, message: 'Tool execution failed: ' + err.message })
                                }
                            }));
                            dcRef.current.send(JSON.stringify({ type: 'response.create' }));
                        }
                    });
                } catch (e: any) {
                    console.error('Function parse error:', e);
                    setChatLog((prev) => [...prev, { role: 'assistant', content: \`[SYSTEM] Parse Error \${name}: \${e.message}\` }]);
                    if (dcRef.current) {
                        dcRef.current.send(JSON.stringify({
                            type: 'conversation.item.create',
                            item: {
                                type: 'function_call_output',
                                call_id: call_id,
                                output: JSON.stringify({ success: false, message: 'Invalid arguments format.' })
                            }
                        }));
                        dcRef.current.send(JSON.stringify({ type: 'response.create' }));
                    }
                }
            }`;

if (content.includes('if (type === \\'response.function_call_arguments.done\\')')) {
    content = content.replace(targetFunctionBlock, debugFunctionBlock);
    fs.writeFileSync(path, content);
    console.log("Injected UI debugging successfully.");
} else {
    console.log("Could not find exact block to replace!");
}
