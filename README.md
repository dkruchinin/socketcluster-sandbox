# socketcluster-sandbox

I created this repo to simplify a setup for testing different failure modes of socketcluster. It spawns up two standard
socketcluster workers sitting behind a round-robin load balancer (haproxy), two scc-broker nodes, one scc-state instace and
three containers with socketcluster clients that can work as either publishers or subscribers. I also use [pubmba](https://github.com/alexei-led/pumba)
to emulate network delays and kill containers. See [SocketCluster/socketcluster#435](https://github.com/SocketCluster/socketcluster/issues/435) for more details.

# Building and running

```
% docker pull gaiaadm/pumba
% make setup
% make && make deploy
% docker ps
3b9ccb9c4b8d        socketcluster/scc-broker:v6.0.1       "npm start"              22 seconds ago      Up 20 seconds       8888/tcp                    sandbox_scc_broker.2.wpkjydy0ctvggxtmueixi9bdu
88be66d79f49        socketcluster/scc-broker:v6.0.1       "npm start"              22 seconds ago      Up 20 seconds       8888/tcp                    sandbox_scc_broker.1.za91tp6e0r3z551xb6qo8pph1
0cf882eeca78        socketcluster/socketcluster:v14.0.4   "npm run start:docker"   25 seconds ago      Up 22 seconds       8000/tcp                    sandbox_socketcluster.2.209d1bdsj5fr1g865xjgw5y6i
5dc29e1f316a        socketcluster/socketcluster:v14.0.4   "npm run start:docker"   25 seconds ago      Up 19 seconds       8000/tcp                    sandbox_socketcluster.1.u9njadbwr8wgyj2peqxy5clqs
39b5a03739ea        dockercloud/haproxy:latest            "/sbin/tini -- docke…"   27 seconds ago      Up 25 seconds       80/tcp, 443/tcp, 1936/tcp   sandbox_proxy.1.hipznlrsq4edc2sws7uqxji6h
b95ac60bd91c        socketcluster_client:latest           "tail -f /dev/null"      28 seconds ago      Up 26 seconds                                   sandbox_socketcluster_client.3.kym4pmncqky74a4mjm2lv73pp
cddab70917de        socketcluster_client:latest           "tail -f /dev/null"      28 seconds ago      Up 26 seconds                                   sandbox_socketcluster_client.1.dbg86lm94pwljnqneo8xh8vbw
538ca5dd48c4        socketcluster_client:latest           "tail -f /dev/null"      28 seconds ago      Up 26 seconds                                   sandbox_socketcluster_client.2.napqn7zsd7csqvf3w32nqwtjr
845a4dca272c        socketcluster/scc-state:v6.1.0        "npm start"              30 seconds ago      Up 29 seconds       7777/tcp                    sandbox_scc_state.1.ng3nf49c33hgqzlnnxzz3ropa
```

# Failure example

1. Attach to the log output of two scc-brokers in different terminals:
```
% docker logs -f 3b9ccb9c4b8d
% docker logs -f 3b9ccb9c4b8d
```
2. Launch two subcribers and one subscriber:
```
% docker exec -it b95ac60bd91c bash                                                                                                                                                   3411  14:52:21
root@b95ac60bd91c:/usr/src# node sub.js
Feed me!
...
% docker exec -it cddab70917de bash                                                                                                                                         INT(-2) ↵  3373  14:48:08
root@cddab70917de:/usr/src# node sub.js
Feed me!
% root@538ca5dd48c4:/usr/src# for i in `seq 1 10`; do echo "$i"; done | node pub.js
...
```
3. Make sure it all works fine: `b95ac60bd91c` and `cddab70917de` should print all 10 messages sent by the publisher (`cddab70917de`)
4. Take a look at the `scc-broker` logs and find the one that handles the only subscription clients use. You should see a line
in the logs looking somewhat like this -- `::ffff:10.0.0.13 subscribed to test_chan`. In my case it's `3b9ccb9c4b8d` (i.e. `sandbox_scc_broker.2`)
5. Launch `pumba` and introduce a small network delay on the `sandbox_scc_broker.2` side. This small delay will give us enough time
to kill the broker node while it has some messages in its socket queues:
```
% sudo docker run -it -v /var/run/docker.sock:/var/run/docker.sock --rm gaiaadm/pumba 'sh'
% pumba netem --duration 5m delay --time 3000 re2:sandbox_scc_broker.2
```
6. Launch the publisher to start streaming some messages:
```
% for i in `seq 1 10000`; do echo "$i"; done | node pub.js
```
7. While subscribers scrape out the messages from the subscription, kill the broker handling the subscription:
```
% sudo docker run -it -v /var/run/docker.sock:/var/run/docker.sock --rm gaiaadm/pumba 'sh'
pumba kill re2:sandbox_scc_broker.2
```

You should see that the subscribers didn't get all the messages sent by the publisher, moreover their websocket connections were not
interupted by the workers, publisher's messages just got lost and the subscribers were not notified about the problem properly.
