#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#include <sys/time.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <netdb.h>
#include <time.h>
#include <sys/fcntl.h>
#include <stdbool.h>

#define PORT 3010
#define ACK_TIMEOUT 900000 // Microseconds
#define TOTAL_LENGTH 500000000

int main(int argc, char* argv[]) {
    if (argc != 4) {
        fprintf(stderr, "Usage: <t|u> <size> <s|w>\n");
        exit(1);
    }

    bool udp = argv[1][0] == 'u';
    int msgSize = atoi(argv[2]);
    bool stopAndWait = argv[3][0] == 'w';

    int sock;

    if (udp) {
        sock = socket(AF_INET, SOCK_DGRAM, 0);
    } else {
        sock = socket(AF_INET, SOCK_STREAM, 0);
    }

    if (sock < 0) {
        fprintf(stderr, "Error opening socket\n");
        exit(1);
    }

    int on = 1;
    setsockopt(sock, SOL_SOCKET, SO_REUSEADDR, &on, sizeof(on));

    int flags = fcntl(sock, F_GETFL, 0);
    fcntl(sock, F_SETFL, flags | O_NONBLOCK);

    struct sockaddr_in server;
    memset(&server, 0, sizeof(server));
    server.sin_family = AF_INET;
    server.sin_addr.s_addr = htonl(INADDR_ANY);
    server.sin_port = htons(PORT);

    if (0 != bind(sock, (struct sockaddr*) &server, sizeof(server))) {
        fprintf(stderr, "Bind error");
        close(sock);
        exit(1);
    }

    if (!udp) {
        if (0 != listen(sock, 1)) {
            fprintf(stderr, "Listen error");
            close(sock);
            exit(1);
        }

        printf("Listening...\n");
    }

    struct sockaddr_in incoming;
    socklen_t incomingLen = sizeof(incoming);

    memset(&incoming, 0, sizeof(incoming));

    int client;

    while(1) {
        if (!udp) {
            while (-1 == (client = accept(sock, (struct sockaddr*)&incoming, &incomingLen))) ;

            printf("\nGot connection\n");
        }

        uint32_t messages = 0;

        char* buffer = malloc(TOTAL_LENGTH);
        uint32_t i = 0;
        memset(buffer, 0, TOTAL_LENGTH);

        struct timeval start;
        gettimeofday(&start, NULL);

        struct timeval stopper;
        gettimeofday(&stopper, NULL);

        uint32_t byteCounter = 0;

        while (1) {
            uint32_t size = msgSize;

_recv: ;
            struct timeval msgStart;
            gettimeofday(&msgStart, NULL);

            while (size > 0) {
                errno = 0;
                int res;

                if (udp) {
                    res = recvfrom(sock, buffer + i, size, 0, (struct sockaddr*) &incoming, &incomingLen);
                } else {
                    res = recv(client, buffer + i, size, 0);
                }

                if (res <= 0) {
                    if (errno != EAGAIN && errno != EWOULDBLOCK) {
                        // Socket closed
                        goto _end;
                    }
                } else {
                    size -= res;
                    byteCounter += res;

                    gettimeofday(&stopper, NULL);
                }

                if (udp) {
                    struct timeval current;
                    gettimeofday(&current, NULL);

                    // 10 seconds of no activity -> client disconnected
                    if (current.tv_usec - stopper.tv_usec + (current.tv_sec - stopper.tv_sec) * 1000000 >= 10000000) {
                        goto _end;
                    }
                }

                if (stopAndWait) {
                    struct timeval msgCurrent;
                    gettimeofday(&msgCurrent, NULL);

                    if (msgCurrent.tv_usec - msgStart.tv_usec + (msgCurrent.tv_sec - msgStart.tv_sec) * 1000000 >= ACK_TIMEOUT) {
                        goto _recv; // Re-receive
                    }
                }
            }

            //printf("Received 1 message\n");

            if (stopAndWait) {
                char ack = 1;

                if (udp) {
                    sendto(sock, &ack, sizeof(ack), 0, (struct sockaddr*) &incoming, sizeof(incoming));
                } else {
                    send(client, &ack, sizeof(ack), 0);
                }
            }

            ++messages;
        }

_end: ;

        free(buffer);

        if (byteCounter > 0) {
            struct timeval end;
            gettimeofday(&end, NULL);

            double time = (double) (end.tv_usec - start.tv_usec) / 1000000.0 + (double) (end.tv_sec - start.tv_sec);

            printf("\nBytes received: %u\nMessages received: %u\nTime: %f\n", byteCounter, messages, time);

            if (!udp) {
                close(client);
            }
        }
    }

    close(sock);
}