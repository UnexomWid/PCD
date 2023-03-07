#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#include <sys/time.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <sys/fcntl.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <netdb.h>
#include <time.h>
#include <stdbool.h>

#define ACK_TIMEOUT 1000000 // Microseconds
#define TOTAL_LENGTH 500000000

int main(int argc, char* argv[]) {
    if (argc != 6) {
        fprintf(stderr, "Usage: <t|u> <size> <s|w> <host> <port>\n");
        exit(1);
    }

    bool udp = argv[1][0] == 'u';
    int msgSize = atoi(argv[2]);
    bool stopAndWait = argv[3][0] == 'w';

    const char* host = argv[4];
    int port = atoi(argv[5]);

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

    struct sockaddr_in server;
    memset(&server, 0, sizeof(server));
    server.sin_family = AF_INET;
    server.sin_addr.s_addr = inet_addr(host);
    server.sin_port = htons(port);

    if (!udp) {
        if (0 > connect(sock, (struct sockaddr*) &server, sizeof(server))) {
            fprintf(stderr, "Error connecting\n");
            close(sock);
            exit(1);
        }
    }

    int flags = fcntl(sock, F_GETFL, 0);
    fcntl(sock, F_SETFL, flags | O_NONBLOCK);

    uint8_t* data = malloc(TOTAL_LENGTH);
    uint32_t length = TOTAL_LENGTH;

    for (int i = 0; i < TOTAL_LENGTH; ++i) {
        data[i] = i % 256;
    }

    uint32_t i = 0;

    uint32_t byteCounter = 0;
    uint32_t messages = 0;

    struct timeval start;
    gettimeofday(&start, NULL);

    while (i < length) {
        uint32_t size = msgSize;
        if (i + msgSize > length) {
            size = length - i;
        }

_send: ;

        int res;
        
        do {
            errno = 0;

            if (udp) {
                res = sendto(sock, data + i, size, MSG_NOSIGNAL, (struct sockaddr*) &server, sizeof(server));
            } else {
                res = send(sock, data + i, size, MSG_NOSIGNAL);
            }
        } while(res <= 0 || errno == EAGAIN || errno == EWOULDBLOCK);

        if (res <= 0) {
            fprintf(stderr, "Send error\n");
            close(sock);
            exit(1);
        }

        byteCounter += size;

        if (stopAndWait) {
            char ack;

            struct timeval ackStart;
            gettimeofday(&ackStart, NULL);

            while (1) {
                errno = 0;
                int res;

                if (udp) {
                    socklen_t len = sizeof(server);
                    res = recvfrom(sock, &ack, sizeof(ack), 0, (struct sockaddr*) &server, &len);
                } else {
                    res = recv(sock, &ack, sizeof(ack), 0);
                }

                if (res < 0 && errno != EAGAIN && errno != EWOULDBLOCK) {
                    fprintf(stderr, "ACK read error\n");
                    close(sock);
                    exit(1);
                }

                if (res == 1) {
                    // ACK
                    break;
                }

                struct timeval ackCurrent;
                gettimeofday(&ackCurrent, NULL);

                if (ackCurrent.tv_usec - ackStart.tv_usec + (ackCurrent.tv_sec - ackStart.tv_sec) * 1000000 >= ACK_TIMEOUT) {
                    //printf("Re-sending\n");
                    goto _send; // Resend
                }
            }
        }

        i += msgSize;

        //printf("Sent 1 message\n");

        ++messages;
    }

    struct timeval end;
    gettimeofday(&end, NULL);

    double time = (double) (end.tv_usec - start.tv_usec) / 1000000.0 + (double) (end.tv_sec - start.tv_sec);

    printf("\nBytes sent: %u\nMessages sent: %u\nTime: %f\n", byteCounter, messages, time);

    shutdown(sock, SHUT_RDWR);
    close(sock);
}