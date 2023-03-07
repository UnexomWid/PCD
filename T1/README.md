# Homework 1 Report

## Summary

- Client: sends 500MB of data to the server
- Server: reads the data sent by the client

The message size, along with the protocol, are all customizable.

## Messsage size

The message size denotes how many bytes to write via a `send` call at a time.

## Transmission mechanisms

- Stream: the client sends the data continuously
- Stop-and-wait: the client send a message, waits for ACK, and sends the next message. If the server doesn't acknowledge in 1 second, the client sends the message again

## Usage

Server

```sh
./server <tcp/udp> <message_size> <s/w>
```

where:

- **s**: stream
- **w**: stop-and-wait

Client

```sh
./client <tcp/udp> <message_size> <s/w> <host> <port>
```

where:

- **s**: stream
- **w**: stop-and-wait

## Experiments

The performance tests were conducted on separate VPS instances hosted on VULTR as follows:

- Client: hosted in Amsterdam, Netherlands
- Server: hosted in Frankfurt, Germany

Both machines have similar specifications (1vCPU, 2GB RAM, Debian 11 x64). The source files were compiled with GCC, using the `-O3 -Wall` flags.

The following message sizes were tested:

- 1000
- 10000
- 32500
- 65000

Each combination of protocol-mechanism was tested:

- TCP stream
- TCP stop-and-wait
- UDP stream
- UDP stop-and-wait

For UDP stream, the integrity rate was also measured. This shows how many bytes of the original data have been received, and how many have been lost.

### Results

